#!/usr/bin/env python3
"""
Maryland Real-Estate-Investor scraper (ScrapeGraphAI + gpt-4o-mini).

Reads a list of directory / listing "source" URLs, uses ScrapeGraphAI's
SmartScraperGraph to extract businesses from each page, de-duplicates, and
appends rows to a CSV with the columns requested:

    business_name, website, phone, address, source_url, date_checked

Design goals:
  * Resumable  -> each new row is flushed to disk immediately; already-processed
                  source URLs are recorded in a sidecar log and skipped on re-run.
  * De-duped   -> keyed on website domain, else phone digits, else normalized name.
  * Honest     -> never invents rows; an empty/blocked page yields nothing.
  * Polite     -> per-request delay and optional robots.txt enforcement.

This script is meant to run on a machine with open internet access and a real
OPENAI_API_KEY in the environment (or in a .env file next to it). It canNOT run
inside the restricted cloud sandbox, whose proxy blocks api.openai.com and the
target sites.

Usage:
    python scrape_md_investors.py --sources sources.txt --out md_investors.csv
    python scrape_md_investors.py --selftest     # offline check, no network/key

Run `python scrape_md_investors.py --help` for all options.
"""

from __future__ import annotations

import argparse
import csv
import os
import re
import sys
import time
import json
from datetime import date
from pathlib import Path
from typing import Any, Iterable
from urllib.parse import urlparse
from urllib import robotparser

CSV_FIELDS = ["business_name", "website", "phone", "address", "source_url", "date_checked"]

DEFAULT_MODEL = "openai/gpt-4o-mini"

# The instruction handed to the LLM for every listing page.
EXTRACTION_PROMPT = (
    "You are extracting business leads from this web page. "
    "Return ONLY a JSON array (possibly empty) of objects, one per DISTINCT "
    "business that is a real-estate investor, real-estate investment company, "
    "property-buying ('we buy houses') company, wholesaler, or similar "
    "real-estate-investing business operating in Maryland (MD). "
    "Each object must have exactly these keys: "
    '"business_name", "website", "phone", "address". '
    "Use an empty string for any field not present on the page. "
    "Do NOT guess, invent, or complete missing values. "
    "Do NOT include unrelated businesses (e.g. generic realtors/brokerages, "
    "mortgage lenders, or results outside Maryland) unless the page clearly "
    "presents them as real-estate investors. "
    "If the page shows no such businesses, return []."
)


# --------------------------------------------------------------------------- #
# Source-file parsing (supports page-range templates like {1-10} or {1..10})
# --------------------------------------------------------------------------- #
_RANGE_RE = re.compile(r"\{(\d+)\s*(?:-|\.\.)\s*(\d+)\}")


def expand_source_line(line: str) -> list[str]:
    """Expand a single source line into concrete URLs.

    A line may contain ONE range template, e.g.
        https://site/search?q=md+investor&page={1-5}
    expands to page=1 .. page=5. Lines without a template pass through as-is.
    """
    m = _RANGE_RE.search(line)
    if not m:
        return [line]
    start, end = int(m.group(1)), int(m.group(2))
    if start > end:
        start, end = end, start
    return [_RANGE_RE.sub(str(i), line, count=1) for i in range(start, end + 1)]


def load_sources(path: Path) -> list[str]:
    urls: list[str] = []
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        # allow an inline "  # note" trailing comment
        line = line.split("  #", 1)[0].strip()
        if not line:
            continue
        urls.extend(expand_source_line(line))
    # preserve order but drop exact dupes
    seen: set[str] = set()
    out: list[str] = []
    for u in urls:
        if u not in seen:
            seen.add(u)
            out.append(u)
    return out


# --------------------------------------------------------------------------- #
# Normalization / de-duplication
# --------------------------------------------------------------------------- #
def norm_host(website: str) -> str:
    if not website:
        return ""
    w = website.strip()
    if not re.match(r"^[a-zA-Z]+://", w):
        w = "http://" + w
    host = (urlparse(w).hostname or "").lower()
    if host.startswith("www."):
        host = host[4:]
    return host


def norm_phone(phone: str) -> str:
    digits = re.sub(r"\D", "", phone or "")
    # drop US country-code leading 1 for consistency
    if len(digits) == 11 and digits.startswith("1"):
        digits = digits[1:]
    return digits


def norm_name(name: str) -> str:
    n = re.sub(r"[^a-z0-9]+", " ", (name or "").lower()).strip()
    return re.sub(r"\s+", " ", n)


def dedupe_key(row: dict[str, str]) -> str | None:
    host = norm_host(row.get("website", ""))
    if host:
        return "w:" + host
    phone = norm_phone(row.get("phone", ""))
    if len(phone) >= 10:
        return "p:" + phone
    name = norm_name(row.get("business_name", ""))
    if name:
        return "n:" + name
    return None  # nothing identifying -> skip


# --------------------------------------------------------------------------- #
# Coerce whatever ScrapeGraphAI returns into a list of flat dict records
# --------------------------------------------------------------------------- #
def coerce_records(result: Any) -> list[dict[str, str]]:
    """ScrapeGraphAI may return a list, a dict wrapping a list, or a single
    record dict. Normalize all of those into a list of {field: str} dicts."""
    candidates: list[Any] = []
    if isinstance(result, list):
        candidates = result
    elif isinstance(result, dict):
        # find the first list value, e.g. {"businesses": [...]}
        list_vals = [v for v in result.values() if isinstance(v, list)]
        if list_vals:
            candidates = list_vals[0]
        elif any(k in result for k in ("business_name", "name", "company")):
            candidates = [result]
        else:
            candidates = []
    out: list[dict[str, str]] = []
    for item in candidates:
        if not isinstance(item, dict):
            continue
        out.append(
            {
                "business_name": _s(item, "business_name", "name", "company", "company_name"),
                "website": _s(item, "website", "url", "site", "web"),
                "phone": _s(item, "phone", "telephone", "phone_number", "tel"),
                "address": _s(item, "address", "location", "full_address"),
            }
        )
    return out


def _s(d: dict, *keys: str) -> str:
    for k in keys:
        v = d.get(k)
        if v:
            return str(v).strip()
    return ""


# --------------------------------------------------------------------------- #
# CSV + processed-log helpers (resume support)
# --------------------------------------------------------------------------- #
def load_existing(out_path: Path) -> set[str]:
    seen: set[str] = set()
    if not out_path.exists():
        return seen
    with out_path.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            k = dedupe_key(row)
            if k:
                seen.add(k)
    return seen


def append_rows(out_path: Path, rows: Iterable[dict[str, str]]) -> None:
    new_file = not out_path.exists()
    with out_path.open("a", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=CSV_FIELDS)
        if new_file:
            w.writeheader()
        for r in rows:
            w.writerow({k: r.get(k, "") for k in CSV_FIELDS})


def processed_log_path(out_path: Path) -> Path:
    return out_path.with_suffix(out_path.suffix + ".processed")


def load_processed(out_path: Path) -> set[str]:
    p = processed_log_path(out_path)
    if not p.exists():
        return set()
    return {ln.strip() for ln in p.read_text(encoding="utf-8").splitlines() if ln.strip()}


def mark_processed(out_path: Path, url: str) -> None:
    with processed_log_path(out_path).open("a", encoding="utf-8") as f:
        f.write(url + "\n")


# --------------------------------------------------------------------------- #
# robots.txt
# --------------------------------------------------------------------------- #
_robots_cache: dict[str, robotparser.RobotFileParser | None] = {}


def robots_allows(url: str, user_agent: str) -> bool:
    try:
        parts = urlparse(url)
        base = f"{parts.scheme}://{parts.netloc}"
        rp = _robots_cache.get(base)
        if rp is None and base not in _robots_cache:
            rp = robotparser.RobotFileParser()
            rp.set_url(base + "/robots.txt")
            try:
                rp.read()
            except Exception:
                rp = None  # couldn't read -> treat as allowed
            _robots_cache[base] = rp
        if rp is None:
            return True
        return rp.can_fetch(user_agent, url)
    except Exception:
        return True


# --------------------------------------------------------------------------- #
# ScrapeGraphAI runner (imported lazily so --selftest needs no install)
# --------------------------------------------------------------------------- #
def build_config(api_key: str, model: str, headless: bool, verbose: bool) -> dict:
    return {
        "llm": {"api_key": api_key, "model": model},
        "verbose": verbose,
        "headless": headless,
    }


def scrape_one(url: str, config: dict) -> list[dict[str, str]]:
    from scrapegraphai.graphs import SmartScraperGraph  # lazy import

    graph = SmartScraperGraph(prompt=EXTRACTION_PROMPT, source=url, config=config)
    result = graph.run()
    return coerce_records(result)


# --------------------------------------------------------------------------- #
# Main
# --------------------------------------------------------------------------- #
def run(args: argparse.Namespace) -> int:
    try:
        from dotenv import load_dotenv

        load_dotenv()
    except Exception:
        pass

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        print("ERROR: OPENAI_API_KEY not set (env or .env). Cannot call the model.", file=sys.stderr)
        return 2

    sources_path = Path(args.sources)
    if not sources_path.exists():
        print(f"ERROR: sources file not found: {sources_path}", file=sys.stderr)
        return 2

    out_path = Path(args.out)
    sources = load_sources(sources_path)
    processed = load_processed(out_path)
    seen = load_existing(out_path)

    todo = [u for u in sources if u not in processed]
    if args.limit:
        todo = todo[: args.limit]

    print(f"Sources: {len(sources)} total, {len(processed)} already done, {len(todo)} to process.")
    print(f"Existing unique businesses in CSV: {len(seen)}")
    print(f"Model: {args.model} | delay: {args.delay}s | robots: {'off' if args.ignore_robots else 'on'}")
    print("-" * 60)

    config = build_config(api_key, args.model, not args.no_headless, args.verbose)

    added = dupes = errors = skipped_robots = 0
    try:
        for i, url in enumerate(todo, 1):
            if args.max_rows and len(seen) >= args.max_rows:
                print(f"Reached --max-rows={args.max_rows}; stopping.")
                break

            if not args.ignore_robots and not robots_allows(url, args.user_agent):
                print(f"[{i}/{len(todo)}] robots.txt disallows, skipping: {url}")
                skipped_robots += 1
                mark_processed(out_path, url)
                continue

            print(f"[{i}/{len(todo)}] scraping: {url}")
            try:
                records = scrape_one(url, config)
            except Exception as e:  # noqa: BLE001
                print(f"    ! error: {e}")
                errors += 1
                time.sleep(args.delay)
                continue

            today = date.today().isoformat()
            fresh: list[dict[str, str]] = []
            for rec in records:
                rec["source_url"] = url
                rec["date_checked"] = today
                key = dedupe_key(rec)
                if key is None:
                    continue
                if key in seen:
                    dupes += 1
                    continue
                seen.add(key)
                fresh.append(rec)

            if fresh:
                append_rows(out_path, fresh)
                added += len(fresh)
            print(f"    extracted {len(records)}, new {len(fresh)} (total unique {len(seen)})")

            mark_processed(out_path, url)
            time.sleep(args.delay)
    except KeyboardInterrupt:
        print("\nInterrupted - progress saved; re-run to resume.")

    print("-" * 60)
    print(f"Done. new rows: {added} | duplicates skipped: {dupes} | "
          f"robots-skipped: {skipped_robots} | errors: {errors}")
    print(f"Unique businesses in {out_path}: {len(seen)}")
    return 0


# --------------------------------------------------------------------------- #
# Offline self-test (no network, no key, no scrapegraphai required)
# --------------------------------------------------------------------------- #
def selftest() -> int:
    import tempfile

    ok = True

    def check(name: str, cond: bool) -> None:
        nonlocal ok
        print(f"  [{'PASS' if cond else 'FAIL'}] {name}")
        ok = ok and cond

    # page-range expansion
    exp = expand_source_line("https://x/s?page={1-3}")
    check("range expansion {1-3} -> 3 urls", exp == [
        "https://x/s?page=1", "https://x/s?page=2", "https://x/s?page=3"])
    check("dotdot expansion {2..4}", expand_source_line("a{2..4}") == ["a2", "a3", "a4"])
    check("no-template passthrough", expand_source_line("https://x/y") == ["https://x/y"])

    # normalization
    check("host strips www+scheme+path",
          norm_host("https://www.Acme-Homes.com/contact") == "acme-homes.com")
    check("phone strips to 10 digits",
          norm_phone("+1 (410) 555-1234") == "4105551234")

    # coercion of various shapes
    r1 = coerce_records([{"name": "A", "url": "a.com", "telephone": "410-555-0001"}])
    check("coerce list w/ alias keys", r1 and r1[0]["business_name"] == "A"
          and r1[0]["website"] == "a.com" and r1[0]["phone"] == "410-555-0001")
    r2 = coerce_records({"businesses": [{"business_name": "B"}]})
    check("coerce dict-wrapped list", r2 and r2[0]["business_name"] == "B")
    r3 = coerce_records({"business_name": "C", "website": "c.com"})
    check("coerce single record dict", r3 and r3[0]["business_name"] == "C")
    check("coerce junk -> []", coerce_records("nope") == [])

    # dedupe keys
    check("dedupe prefers website",
          dedupe_key({"website": "http://www.X.com", "phone": "410-555-0000"}) == "w:x.com")
    check("dedupe falls back to phone",
          dedupe_key({"business_name": "Y", "phone": "(410) 555-0000"}) == "p:4105550000")
    check("dedupe falls back to name",
          dedupe_key({"business_name": "Z Co"}) == "n:z co")
    check("dedupe none when empty", dedupe_key({"business_name": "", "phone": "", "website": ""}) is None)

    # CSV round-trip + resume dedupe
    with tempfile.TemporaryDirectory() as d:
        out = Path(d) / "t.csv"
        append_rows(out, [{
            "business_name": "Acme", "website": "acme.com", "phone": "4105551234",
            "address": "1 Main St, Baltimore, MD", "source_url": "http://src/1",
            "date_checked": "2026-11-09"}])
        text = out.read_text(encoding="utf-8")
        check("csv header written", text.splitlines()[0] == ",".join(CSV_FIELDS))
        check("csv row written", "Acme" in text and "acme.com" in text)
        reseen = load_existing(out)
        check("resume rebuilds dedupe set", "w:acme.com" in reseen)
        mark_processed(out, "http://src/1")
        check("processed log round-trips", load_processed(out) == {"http://src/1"})

    print("\nSELFTEST:", "ALL PASS" if ok else "FAILURES PRESENT")
    return 0 if ok else 1


def main() -> int:
    p = argparse.ArgumentParser(description="Scrape Maryland real-estate investors via ScrapeGraphAI.")
    p.add_argument("--sources", default="sources.txt", help="file of listing URLs (default: sources.txt)")
    p.add_argument("--out", default="md_investors.csv", help="output CSV (default: md_investors.csv)")
    p.add_argument("--model", default=DEFAULT_MODEL, help=f"LLM model (default: {DEFAULT_MODEL})")
    p.add_argument("--delay", type=float, default=3.0, help="seconds between requests (default: 3)")
    p.add_argument("--limit", type=int, default=0, help="max source URLs this run (0 = all)")
    p.add_argument("--max-rows", type=int, default=0, help="stop once CSV has this many unique rows (0 = no cap)")
    p.add_argument("--no-headless", action="store_true", help="show the browser window")
    p.add_argument("--ignore-robots", action="store_true", help="do not honor robots.txt (not recommended)")
    p.add_argument("--user-agent", default="Mozilla/5.0 (compatible; MD-Investor-Research/1.0)",
                   help="user-agent used for robots.txt checks")
    p.add_argument("--verbose", action="store_true", help="verbose ScrapeGraphAI logging")
    p.add_argument("--selftest", action="store_true", help="run offline self-test and exit")
    args = p.parse_args()

    if args.selftest:
        return selftest()
    return run(args)


if __name__ == "__main__":
    raise SystemExit(main())
