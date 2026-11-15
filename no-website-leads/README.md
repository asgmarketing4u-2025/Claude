# No-Website Business Finder (Baltimore / MD / DC / VA / NJ / NC)

Finds local businesses that have **no website** — prime prospects for a web /
marketing agency — across your target region, into one de-duplicated CSV:

| column | meaning |
|---|---|
| `business_name` | business name |
| `category` | the category/query it was found under |
| `address` | full address |
| `phone` | phone number |
| `website` | always blank (these are the no-website leads) |
| `maps_url` | Google Maps link (Places results only) |
| `source` | `google_places` or `scrapegraph` |
| `date_checked` | ISO date the row was found |

Two engines write to the same file, de-duplicated by name + ZIP/address:

1. **`places_finder.py` — Google Places API (authoritative).** Reads each
   business's actual website field from Google's record. If it's empty, that's a
   real "no website" signal. **Use this as your primary source.**
2. **`scrape_finder.py` — ScrapeGraphAI (gpt-4o-mini) directory pass.** Scrapes
   directory/association pages and keeps listings with no URL. Surfaces some
   businesses Places misses, but a directory omitting a URL doesn't *prove* the
   business has no site — treat `scrapegraph` rows as weaker leads.

Per your choice, the tool flags **"no website" only** — it does not try to judge
whether an existing site "needs an update."

## ⚠️ Run locally, not in the Claude cloud session

The cloud sandbox's proxy blocks `places.googleapis.com`, `api.openai.com`, and
the target sites, so neither engine can run there. Run on your machine.

## Setup

```bash
cd no-website-leads
python3 -m venv venv && source venv/bin/activate     # Python 3.12+ recommended

# Engine 1 (Google Places) needs no extra packages (standard library only).
# Engine 2 (ScrapeGraphAI) needs:
pip install scrapegraphai && playwright install chromium

# Keys — put them in a .env file next to the scripts:
cat > .env <<'EOF'
GOOGLE_MAPS_API_KEY=your_google_maps_platform_key
OPENAI_API_KEY=sk-...        # only needed for engine 2
EOF
```

**Getting a Google Maps Platform key:** create a project at
<https://console.cloud.google.com/>, enable the **Places API (New)**, create an
API key, and enable billing. Text Search with the website field runs on the
"Text Search (Pro)" SKU — on the order of a few dollars per few thousand lookups,
and Google includes a recurring monthly free credit. Restrict the key to the
Places API.

Verify everything offline first (no keys/network needed):

```bash
python common.py --selftest 2>/dev/null || python -c "import common; common.selftest()"
python places_finder.py --selftest
python scrape_finder.py --selftest
```

## Run

**Primary — Google Places.** Edit `queries.txt` (category | city lines), then:

```bash
# start small to confirm output + watch billing
python places_finder.py --queries queries.txt --out no_website_leads.csv --limit 5

# then the full set (resumes automatically; stop/restart anytime)
python places_finder.py --queries queries.txt --out no_website_leads.csv
```

**Secondary — directory scrape.** Put real directory URLs in `sources.txt`, then:

```bash
python scrape_finder.py --sources sources.txt --out no_website_leads.csv --limit 5
```

Both write to the **same** `no_website_leads.csv` and skip anything already in
it. Resume state lives in `no_website_leads.csv.processed`; delete it to re-run.

## Coverage & expectations

- Places text search returns up to ~60 results per query, so **coverage scales
  with how many category × city combinations you list.** The starter
  `queries.txt` covers all six areas lightly — expand the city and category lists
  to go deeper. Six states exhaustively is a lot of queries; add them in batches.
- A meaningful share of local service businesses (plumbers, HVAC, auto repair,
  salons, small restaurants) genuinely have no website, so this produces real,
  workable prospect volume — but it's built query by query, not as one giant dump.
- **Cost:** Places billing scales with lookups; gpt-4o-mini is cheap. Start with
  `--limit` and check your dashboards before scaling.

## Legal / ethical note

This collects **business** contact details from each platform's intended public
interface (Google Places via its official API; directories only where their ToS
and robots.txt allow). It's standard B2B prospecting. Respect each site's terms,
throttle requests, and don't scrape sources that forbid it.
