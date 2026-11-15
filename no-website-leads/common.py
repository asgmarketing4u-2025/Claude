"""
Shared helpers for the "businesses with no website" prospecting tools.

Both engines (Google Places and ScrapeGraphAI) import this so they write to the
SAME de-duplicated CSV with a consistent schema. No third-party dependencies.

CSV schema:
    business_name, category, address, phone, website, maps_url, source, date_checked

Only businesses with NO website are written (that is the whole point of the
tool), so the `website` column is intentionally blank on every row. It is kept
for schema stability and so a future "has website" variant can reuse the file.
"""

from __future__ import annotations

import csv
import os
import re
from pathlib import Path
from typing import Iterable
from urllib.parse import urlparse

CSV_FIELDS = [
    "business_name",
    "category",
    "address",
    "phone",
    "website",
    "maps_url",
    "source",
    "date_checked",
]


# --------------------------------------------------------------------------- #
# Minimal .env loader (so neither engine needs python-dotenv)
# --------------------------------------------------------------------------- #
def load_env(path: str = ".env") -> None:
    p = Path(path)
    if not p.exists():
        return
    for line in p.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        k, v = k.strip(), v.strip().strip('"').strip("'")
        os.environ.setdefault(k, v)


# --------------------------------------------------------------------------- #
# Normalization / de-duplication
# --------------------------------------------------------------------------- #
def norm_name(name: str) -> str:
    n = re.sub(r"[^a-z0-9]+", " ", (name or "").lower()).strip()
    return re.sub(r"\s+", " ", n)


def norm_phone(phone: str) -> str:
    digits = re.sub(r"\D", "", phone or "")
    if len(digits) == 11 and digits.startswith("1"):
        digits = digits[1:]
    return digits


def _zip_or_addr(address: str) -> str:
    m = re.search(r"\b(\d{5})(?:-\d{4})?\b", address or "")
    if m:
        return m.group(1)
    return re.sub(r"[^a-z0-9]+", "", (address or "").lower())[:24]


def dedupe_key(row: dict) -> str | None:
    """Cross-engine key. Name + (zip or compacted address) is the primary key
    because both engines always have those; phone is folded in only when the
    name is missing."""
    name = norm_name(row.get("business_name", ""))
    tail = _zip_or_addr(row.get("address", ""))
    if name:
        return f"na:{name}|{tail}"
    phone = norm_phone(row.get("phone", ""))
    if len(phone) >= 10:
        return f"p:{phone}"
    return None


def has_website(website: str) -> bool:
    w = (website or "").strip()
    if not w:
        return False
    # guard against junk / placeholder values
    if not re.match(r"^[a-zA-Z]+://", w):
        w = "http://" + w
    host = urlparse(w).hostname or ""
    return bool(host) and "." in host


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


def append_rows(out_path: Path, rows: Iterable[dict]) -> int:
    new_file = not out_path.exists()
    n = 0
    with out_path.open("a", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=CSV_FIELDS)
        if new_file:
            w.writeheader()
        for r in rows:
            w.writerow({k: r.get(k, "") for k in CSV_FIELDS})
            n += 1
    return n


def _log_path(out_path: Path) -> Path:
    return out_path.with_suffix(out_path.suffix + ".processed")


def load_processed(out_path: Path) -> set[str]:
    p = _log_path(out_path)
    if not p.exists():
        return set()
    return {ln.strip() for ln in p.read_text(encoding="utf-8").splitlines() if ln.strip()}


def mark_processed(out_path: Path, token: str) -> None:
    with _log_path(out_path).open("a", encoding="utf-8") as f:
        f.write(token + "\n")


# --------------------------------------------------------------------------- #
# Config parsing: "category | location" per line
# --------------------------------------------------------------------------- #
def load_queries(path: Path) -> list[tuple[str, str]]:
    out: list[tuple[str, str]] = []
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        line = line.split("  #", 1)[0].strip()
        if "|" not in line:
            continue
        cat, loc = line.split("|", 1)
        cat, loc = cat.strip(), loc.strip()
        if cat and loc:
            out.append((cat, loc))
    return out


# --------------------------------------------------------------------------- #
# Offline self-test
# --------------------------------------------------------------------------- #
def selftest() -> int:
    import tempfile

    ok = True

    def check(name: str, cond: bool) -> None:
        nonlocal ok
        print(f"  [{'PASS' if cond else 'FAIL'}] {name}")
        ok = ok and cond

    check("has_website true for real url", has_website("https://acme.com"))
    check("has_website true bare domain", has_website("acme.com"))
    check("has_website false empty", not has_website(""))
    check("has_website false junk", not has_website("n/a"))

    check("norm_phone strips", norm_phone("+1 (410) 555-1234") == "4105551234")
    check("dedupe name+zip",
          dedupe_key({"business_name": "Joe's Pizza", "address": "5 Main St, Baltimore, MD 21201"})
          == "na:joe s pizza|21201")
    check("dedupe phone fallback",
          dedupe_key({"business_name": "", "phone": "(410) 555-0000"}) == "p:4105550000")
    check("dedupe none when empty", dedupe_key({"business_name": "", "phone": ""}) is None)

    q = tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False)
    q.write("# comment\nplumber | Baltimore, MD\n bad line no pipe\nhvac | Richmond, VA  # note\n")
    q.close()
    queries = load_queries(Path(q.name))
    check("load_queries parses 2", queries == [("plumber", "Baltimore, MD"), ("hvac", "Richmond, VA")])
    os.unlink(q.name)

    with tempfile.TemporaryDirectory() as d:
        out = Path(d) / "t.csv"
        append_rows(out, [{
            "business_name": "Joe's Pizza", "category": "restaurant",
            "address": "5 Main St, Baltimore, MD 21201", "phone": "4105551234",
            "website": "", "maps_url": "https://maps.google/?cid=1",
            "source": "google_places", "date_checked": "2026-11-15"}])
        text = out.read_text(encoding="utf-8")
        check("csv header", text.splitlines()[0] == ",".join(CSV_FIELDS))
        seen = load_existing(out)
        check("resume dedupe set", "na:joe s pizza|21201" in seen)
        mark_processed(out, "plumber|Baltimore, MD")
        check("processed log", load_processed(out) == {"plumber|Baltimore, MD"})

    print("\nCOMMON SELFTEST:", "ALL PASS" if ok else "FAILURES")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(selftest())
