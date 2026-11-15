#!/usr/bin/env python3
"""
Find businesses with NO website using the Google Places API (v1 searchText).

For each "category | location" query it calls places:searchText, reads each
place's websiteUri, and records only the places that have none. One CSV, shared
with the ScrapeGraphAI engine, de-duplicated across both.

This is the authoritative "has a website?" signal: it comes straight from
Google's place record, not from a directory listing that may just omit the URL.

Runs on a machine with open internet + a Google Maps Platform API key. It canNOT
run in the restricted cloud sandbox (its proxy blocks places.googleapis.com).

Env:
    GOOGLE_MAPS_API_KEY   (env or .env next to this file)

Usage:
    python places_finder.py --queries queries.txt --out no_website_leads.csv
    python places_finder.py --selftest
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import date
from pathlib import Path
from urllib import request, error

import common

ENDPOINT = "https://places.googleapis.com/v1/places:searchText"
FIELD_MASK = ",".join([
    "places.id",
    "places.displayName",
    "places.formattedAddress",
    "places.nationalPhoneNumber",
    "places.websiteUri",
    "places.googleMapsUri",
    "nextPageToken",
])


def parse_places_response(data: dict, category: str, source: str, today: str) -> tuple[list[dict], str | None]:
    """Pure function (unit-tested offline): turn an API response into
    no-website rows plus the nextPageToken. Each place also carries its place_id
    under the private key '_pid' for in-run de-duplication."""
    rows: list[dict] = []
    for place in data.get("places", []) or []:
        website = place.get("websiteUri", "")
        if common.has_website(website):
            continue  # it has a website -> not a prospect
        name = (place.get("displayName") or {}).get("text", "")
        if not name:
            continue
        rows.append({
            "business_name": name,
            "category": category,
            "address": place.get("formattedAddress", ""),
            "phone": place.get("nationalPhoneNumber", ""),
            "website": "",
            "maps_url": place.get("googleMapsUri", ""),
            "source": source,
            "date_checked": today,
            "_pid": place.get("id", ""),
        })
    return rows, data.get("nextPageToken")


def search_text(api_key: str, query: str, page_token: str | None, timeout: int) -> dict:
    body = {"textQuery": query, "pageSize": 20}
    if page_token:
        body["pageToken"] = page_token
    req = request.Request(
        ENDPOINT,
        data=json.dumps(body).encode("utf-8"),
        method="POST",
        headers={
            "Content-Type": "application/json",
            "X-Goog-Api-Key": api_key,
            "X-Goog-FieldMask": FIELD_MASK,
        },
    )
    with request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def run(args: argparse.Namespace) -> int:
    common.load_env()
    import os
    api_key = os.getenv("GOOGLE_MAPS_API_KEY")
    if not api_key:
        print("ERROR: GOOGLE_MAPS_API_KEY not set (env or .env).", file=sys.stderr)
        return 2

    qpath = Path(args.queries)
    if not qpath.exists():
        print(f"ERROR: queries file not found: {qpath}", file=sys.stderr)
        return 2

    out = Path(args.out)
    queries = common.load_queries(qpath)
    processed = common.load_processed(out)
    seen = common.load_existing(out)
    seen_pids: set[str] = set()

    todo = [(c, l) for (c, l) in queries if f"{c}|{l}" not in processed]
    if args.limit:
        todo = todo[: args.limit]

    print(f"Queries: {len(queries)} total, {len(processed)} done, {len(todo)} to run.")
    print(f"Existing rows in CSV: {len(seen)} | pages/query: {args.max_pages} | delay: {args.delay}s")
    print("-" * 60)

    added = skipped_dupe = errors = 0
    for i, (category, location) in enumerate(todo, 1):
        query = f"{category} in {location}"
        print(f"[{i}/{len(todo)}] {query}")
        token: str | None = None
        try:
            for page in range(args.max_pages):
                data = search_text(api_key, query, token, args.timeout)
                today = date.today().isoformat()
                rows, token = parse_places_response(data, category, "google_places", today)
                fresh = []
                for r in rows:
                    pid = r.pop("_pid", "")
                    if pid and pid in seen_pids:
                        continue
                    if pid:
                        seen_pids.add(pid)
                    key = common.dedupe_key(r)
                    if key is None or key in seen:
                        skipped_dupe += 1
                        continue
                    seen.add(key)
                    fresh.append(r)
                if fresh:
                    common.append_rows(out, fresh)
                    added += len(fresh)
                print(f"    page {page + 1}: +{len(fresh)} no-website (running total {len(seen)})")
                if not token:
                    break
                time.sleep(args.delay)
        except error.HTTPError as e:
            msg = e.read().decode("utf-8", "replace")[:300]
            print(f"    ! HTTP {e.code}: {msg}")
            errors += 1
        except Exception as e:  # noqa: BLE001
            print(f"    ! error: {e}")
            errors += 1
        else:
            common.mark_processed(out, f"{category}|{location}")
        time.sleep(args.delay)

    print("-" * 60)
    print(f"Done. new rows: {added} | dupes skipped: {skipped_dupe} | errors: {errors}")
    print(f"Total no-website businesses in {out}: {len(seen)}")
    return 0


def selftest() -> int:
    ok = True

    def check(name, cond):
        nonlocal ok
        print(f"  [{'PASS' if cond else 'FAIL'}] {name}")
        ok = ok and cond

    sample = {
        "places": [
            {"id": "A", "displayName": {"text": "No Site Diner"},
             "formattedAddress": "1 A St, Baltimore, MD 21201",
             "nationalPhoneNumber": "(410) 555-1111"},  # no websiteUri -> prospect
            {"id": "B", "displayName": {"text": "Has Site LLC"},
             "formattedAddress": "2 B St, Richmond, VA 23219",
             "websiteUri": "https://hassite.com"},        # has site -> skip
            {"id": "C", "displayName": {"text": "Blank Web Co"},
             "formattedAddress": "3 C St, Raleigh, NC 27601",
             "websiteUri": ""},                            # empty -> prospect
        ],
        "nextPageToken": "TOK123",
    }
    rows, tok = parse_places_response(sample, "diner", "google_places", "2026-11-15")
    check("keeps only no-website places", len(rows) == 2)
    check("names captured", {r["business_name"] for r in rows} == {"No Site Diner", "Blank Web Co"})
    check("pids captured", {r["_pid"] for r in rows} == {"A", "C"})
    check("website col blank", all(r["website"] == "" for r in rows))
    check("category set", all(r["category"] == "diner" for r in rows))
    check("nextPageToken returned", tok == "TOK123")
    empty_rows, empty_tok = parse_places_response({}, "x", "google_places", "2026-11-15")
    check("empty response safe", empty_rows == [] and empty_tok is None)

    print("\nPLACES SELFTEST:", "ALL PASS" if ok else "FAILURES")
    return 0 if ok else 1


def main() -> int:
    p = argparse.ArgumentParser(description="Find no-website businesses via Google Places API v1.")
    p.add_argument("--queries", default="queries.txt")
    p.add_argument("--out", default="no_website_leads.csv")
    p.add_argument("--max-pages", type=int, default=3, help="result pages per query (<=3; 20 each)")
    p.add_argument("--delay", type=float, default=1.0, help="seconds between API calls")
    p.add_argument("--limit", type=int, default=0, help="max queries this run (0 = all)")
    p.add_argument("--timeout", type=int, default=30)
    p.add_argument("--selftest", action="store_true")
    args = p.parse_args()
    return selftest() if args.selftest else run(args)


if __name__ == "__main__":
    raise SystemExit(main())
