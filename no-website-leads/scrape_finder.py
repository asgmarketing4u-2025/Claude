#!/usr/bin/env python3
"""
Second discovery pass: scrape business-directory listing pages with ScrapeGraphAI
(gpt-4o-mini) and keep only businesses that list NO website. Writes to the SAME
CSV as places_finder.py, de-duplicated across both engines.

Why a second engine? Google Places is authoritative but misses businesses that
aren't well-mapped. Directory pages (chambers of commerce, local association
lists) surface some of those. The trade-off: a directory omitting a URL doesn't
always mean the business has no site, so treat scrape-sourced rows as weaker
leads than Places-sourced ones (the `source` column tells them apart).

Runs locally with an OpenAI key. CanNOT run in the cloud sandbox (proxy blocks
api.openai.com and the target sites).

Env:
    OPENAI_API_KEY   (env or .env next to this file)

Usage:
    python scrape_finder.py --sources sources.txt --out no_website_leads.csv
    python scrape_finder.py --selftest
"""

from __future__ import annotations

import argparse
import os
import sys
import time
from datetime import date
from pathlib import Path

import common

DEFAULT_MODEL = "openai/gpt-4o-mini"

EXTRACTION_PROMPT = (
    "Extract every business listed on this page. Return ONLY a JSON array "
    "(possibly empty) of objects with exactly these keys: "
    '"business_name", "website", "phone", "address", "category". '
    "Set a field to an empty string if it is not shown. "
    "Put the business's own website in \"website\" ONLY if the page actually "
    "shows one; never guess or construct a URL, and do not treat the directory "
    "site's own URL as the business's website. If the page lists no businesses, "
    "return []."
)


def coerce_records(result) -> list[dict]:
    items = []
    if isinstance(result, list):
        items = result
    elif isinstance(result, dict):
        lists = [v for v in result.values() if isinstance(v, list)]
        if lists:
            items = lists[0]
        elif any(k in result for k in ("business_name", "name", "company")):
            items = [result]
    out = []
    for it in items:
        if not isinstance(it, dict):
            continue
        out.append({
            "business_name": _s(it, "business_name", "name", "company", "company_name"),
            "website": _s(it, "website", "url", "site", "web"),
            "phone": _s(it, "phone", "telephone", "phone_number", "tel"),
            "address": _s(it, "address", "location", "full_address"),
            "category": _s(it, "category", "type", "industry"),
        })
    return out


def _s(d: dict, *keys: str) -> str:
    for k in keys:
        v = d.get(k)
        if v:
            return str(v).strip()
    return ""


def scrape_one(url: str, config: dict) -> list[dict]:
    from scrapegraphai.graphs import SmartScraperGraph  # lazy import
    graph = SmartScraperGraph(prompt=EXTRACTION_PROMPT, source=url, config=config)
    return coerce_records(graph.run())


def load_sources(path: Path) -> list[str]:
    urls = []
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        line = line.split("  #", 1)[0].strip()
        if line:
            urls.append(line)
    seen, out = set(), []
    for u in urls:
        if u not in seen:
            seen.add(u)
            out.append(u)
    return out


def run(args: argparse.Namespace) -> int:
    common.load_env()
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        print("ERROR: OPENAI_API_KEY not set (env or .env).", file=sys.stderr)
        return 2

    spath = Path(args.sources)
    if not spath.exists():
        print(f"ERROR: sources file not found: {spath}", file=sys.stderr)
        return 2

    out = Path(args.out)
    sources = load_sources(spath)
    processed = common.load_processed(out)
    seen = common.load_existing(out)
    todo = [u for u in sources if u not in processed]
    if args.limit:
        todo = todo[: args.limit]

    print(f"Sources: {len(sources)} total, {len(processed)} done, {len(todo)} to run.")
    print(f"Existing rows in CSV: {len(seen)} | model: {args.model} | delay: {args.delay}s")
    print("-" * 60)

    config = {
        "llm": {"api_key": api_key, "model": args.model},
        "verbose": args.verbose,
        "headless": not args.no_headless,
    }

    added = kept_has_site = dupes = errors = 0
    for i, url in enumerate(todo, 1):
        print(f"[{i}/{len(todo)}] {url}")
        try:
            records = scrape_one(url, config)
        except Exception as e:  # noqa: BLE001
            print(f"    ! error: {e}")
            errors += 1
            time.sleep(args.delay)
            continue

        today = date.today().isoformat()
        fresh = []
        for rec in records:
            if common.has_website(rec.get("website", "")):
                kept_has_site += 1
                continue  # has a site -> not a prospect
            row = {
                "business_name": rec.get("business_name", ""),
                "category": rec.get("category", ""),
                "address": rec.get("address", ""),
                "phone": rec.get("phone", ""),
                "website": "",
                "maps_url": "",
                "source": "scrapegraph",
                "date_checked": today,
            }
            key = common.dedupe_key(row)
            if key is None or key in seen:
                dupes += 1
                continue
            seen.add(key)
            fresh.append(row)
        if fresh:
            common.append_rows(out, fresh)
            added += len(fresh)
        print(f"    extracted {len(records)}, +{len(fresh)} no-website (total {len(seen)})")
        common.mark_processed(out, url)
        time.sleep(args.delay)

    print("-" * 60)
    print(f"Done. new rows: {added} | had-site skipped: {kept_has_site} | "
          f"dupes: {dupes} | errors: {errors}")
    print(f"Total no-website businesses in {out}: {len(seen)}")
    return 0


def selftest() -> int:
    ok = True

    def check(name, cond):
        nonlocal ok
        print(f"  [{'PASS' if cond else 'FAIL'}] {name}")
        ok = ok and cond

    recs = coerce_records([
        {"name": "No Site Cafe", "telephone": "410-555-0001", "address": "1 St, Baltimore MD 21201"},
        {"business_name": "Has Site Inc", "website": "https://x.com", "address": "2 St"},
    ])
    check("coerce 2 records", len(recs) == 2)
    check("alias name->business_name", recs[0]["business_name"] == "No Site Cafe")
    check("website empty when absent", recs[0]["website"] == "")
    check("filter: no-site kept, site dropped",
          [r for r in recs if not common.has_website(r["website"])][0]["business_name"] == "No Site Cafe")
    check("dict-wrapped list", coerce_records({"items": [{"name": "Z"}]})[0]["business_name"] == "Z")
    check("junk -> []", coerce_records(3) == [])

    print("\nSCRAPE SELFTEST:", "ALL PASS" if ok else "FAILURES")
    return 0 if ok else 1


def main() -> int:
    p = argparse.ArgumentParser(description="Find no-website businesses by scraping directory pages.")
    p.add_argument("--sources", default="sources.txt")
    p.add_argument("--out", default="no_website_leads.csv")
    p.add_argument("--model", default=DEFAULT_MODEL)
    p.add_argument("--delay", type=float, default=3.0)
    p.add_argument("--limit", type=int, default=0)
    p.add_argument("--no-headless", action="store_true")
    p.add_argument("--verbose", action="store_true")
    p.add_argument("--selftest", action="store_true")
    args = p.parse_args()
    return selftest() if args.selftest else run(args)


if __name__ == "__main__":
    raise SystemExit(main())
