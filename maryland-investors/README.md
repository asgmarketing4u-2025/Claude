# Maryland Real-Estate-Investor Scraper

A purpose-built ScrapeGraphAI pipeline that extracts Maryland real-estate
investors from directory/listing pages into a CSV with:

| column | meaning |
|---|---|
| `business_name` | company name |
| `website` | company website |
| `phone` | phone number |
| `address` | street / city / state |
| `source_url` | the exact page the row came from |
| `date_checked` | ISO date the row was scraped |

It de-duplicates (by website domain → phone → name), writes each row to disk
immediately (crash-safe), resumes where it left off, honors `robots.txt`, and
throttles between requests. It **never invents rows** — a blocked or empty page
simply yields nothing.

## ⚠️ Run this on your local machine, not in the Claude cloud session

The cloud sandbox's network proxy blocks outbound traffic to both
`api.openai.com` and the target directory sites (even `example.com` returns
HTTP 403). ScrapeGraphAI therefore cannot run there. Run it locally, where your
`.env` and open internet access already live.

## Setup (local)

```bash
# from your Claude repo checkout
cd maryland-investors

python3 -m venv venv && source venv/bin/activate   # Python 3.12+ recommended
pip install --upgrade pip
pip install scrapegraphai python-dotenv
playwright install chromium                         # ScrapeGraphAI uses a browser

# API key — put your real key in a .env file next to the script:
echo 'OPENAI_API_KEY=sk-...' > .env
```

Verify the plumbing with the offline self-test (no key/network needed):

```bash
python scrape_md_investors.py --selftest
```

## Run

1. **Curate `sources.txt`** — add the directory/listing pages you want scraped.
   See the comments in that file. Use `{1-10}` page templates for paginated
   search result pages.
2. Start small to validate output and watch cost:

   ```bash
   python scrape_md_investors.py --sources sources.txt --out md_investors.csv --limit 5
   ```

3. Scale up (it resumes, so you can stop/restart anytime):

   ```bash
   python scrape_md_investors.py --sources sources.txt --out md_investors.csv
   ```

### Useful options

| flag | default | purpose |
|---|---|---|
| `--model` | `openai/gpt-4o-mini` | LLM used for extraction |
| `--delay` | `3.0` | seconds between requests (be polite) |
| `--limit N` | all | only process N source URLs this run |
| `--max-rows N` | no cap | stop once the CSV holds N unique businesses |
| `--ignore-robots` | off | bypass robots.txt (not recommended) |
| `--no-headless` | off | show the browser window |
| `--verbose` | off | verbose ScrapeGraphAI logs |

Resume state lives in `md_investors.csv.processed` (the list of source URLs
already done). Delete it to re-scrape everything.

## Honest expectations

- **10,000 is very unlikely from public directories.** The high-volume consumer
  directories (YellowPages, Yelp, BBB, Manta, Google) prohibit automated
  scraping in their Terms of Service and actively block bots, so ScrapeGraphAI
  mostly gets CAPTCHAs/empty pages there. The realistic distinct-business yield
  after de-dup from scrape-tolerant sources (REIA member lists, chambers of
  commerce, individual company sites) is more like a few hundred to low
  thousands.
- To push volume up legitimately, combine scraping with **Maryland SDAT**
  business-entity records and consider a paid/licensed data provider if you
  need a large guaranteed list.
- **Cost:** gpt-4o-mini is cheap, but one LLM call runs per source page, plus
  optional website lookups. Start with `--limit` and check your OpenAI usage.

## Legal / ethical note

This collects **business** contact details (name, phone, address, website) for
B2B outreach — generally fine — but respect each site's Terms of Service and
`robots.txt`, throttle your requests, and don't scrape sites that forbid it.
The script defaults to honoring `robots.txt` for that reason.
