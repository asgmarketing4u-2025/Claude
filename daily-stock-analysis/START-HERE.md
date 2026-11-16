# START HERE: Daily Stock Analysis

> **Not investment advice.** This app produces AI-generated opinions from free market
> data. They can be wrong or out of date. Do your own research and talk to a licensed
> financial adviser before buying or selling anything.

## What is installed, and where

- The app lives in this folder: `/home/user/daily_stock_analysis`
- Its Python packages live in a private sub-folder, `.venv`, so nothing else on the
  machine was changed. No admin rights were used.
- Your settings are in the file `.env` (reports in English, watchlist AAPL, MSFT, NVDA,
  Google Gemini as the AI).
- Finished reports are saved in the `reports` folder.

**Important:** this was installed on a temporary cloud machine, not your own computer.
The machine is erased after a period of inactivity. To keep the app permanently, follow
"Install on your own computer" at the bottom.

## Launch it again

Open a terminal and run these one at a time.

```bash
cd /home/user/daily_stock_analysis
```

Analyse the saved watchlist (takes about 1 to 2 minutes):

```bash
.venv/bin/python main.py --no-notify --no-market-review --force-run
```

Analyse different stocks just this once:

```bash
.venv/bin/python main.py --stocks AAPL,TSLA --no-notify --no-market-review --force-run
```

The result appears as `reports/report_YYYYMMDD.md`. To change the saved watchlist,
edit the line `STOCK_LIST=` in `.env`.

Prefer a web page with buttons? Start the built-in dashboard, then open
http://127.0.0.1:8000 in a browser on the same machine. Press Ctrl+C to stop it.

```bash
.venv/bin/python main.py --webui-only
```

What the options mean:
- `--no-notify`: don't try to send the report to Telegram, email, etc. (none are set up)
- `--no-market-review`: skip the extra whole-market summary
- `--force-run`: run even on a weekend or market holiday

## Update it

```bash
cd /home/user/daily_stock_analysis
```

```bash
git pull --ff-only
```

```bash
.venv/bin/pip install -r requirements.txt
```

Your `.env` settings and your reports are kept. If the update adds new settings, they
are listed in `.env.example`.

## Uninstall it

Everything is inside this one folder, so deleting the folder removes the app, its
packages, your settings and all reports. Copy any reports you want to keep first.

```bash
rm -rf /home/user/daily_stock_analysis
```

Two things were also saved in your Claude cloud environment ("Default") and are removed
in its settings, not here:
- the Gemini API key (a network secret for `generativelanguage.googleapis.com`)
- permission to reach Yahoo Finance (five `yahoo.com` hosts in the allowed list)

To cancel the key itself, delete it at https://aistudio.google.com/apikey

## About the Gemini key

- Never paste the key into a chat.
- On this cloud machine the key is not stored in any file. It is held by the cloud
  environment and added to requests automatically, which is why `.env` shows the
  placeholder `proxy-injected`.
- The free tier limits how many requests you can make per minute and per day. If a run
  fails with a "429" or "quota" message, wait a few minutes or shorten the watchlist.

## Known limits of this setup

- No news search is connected, so reports do not consider headlines. The app supports
  free-tier keys from Tavily or SerpAPI if you want news added.
- Only US stocks were tested. Chinese and Hong Kong data sources are blocked by this
  cloud machine's network rules.
- Some numbers in the raw report keep Chinese units: 万 = 10 thousand, 亿 = 100 million.

## Install on your own computer

You need Python 3.10 or newer and Git.

```bash
git clone https://github.com/ZhuLinsen/daily_stock_analysis.git
```

```bash
cd daily_stock_analysis
```

```bash
python3 -m venv .venv
```

```bash
.venv/bin/pip install -r requirements.txt
```

```bash
cp .env.example .env
```

On Windows, use `.venv\Scripts\pip` and `.venv\Scripts\python` instead of `.venv/bin/...`.

Then open `.env` in a text editor and set:

```
STOCK_LIST=AAPL,MSFT,NVDA
REPORT_LANGUAGE=en
GEMINI_API_KEY=your-key-from-aistudio.google.com
```

Run it with the same launch commands as above. The project's own guide in English is
`docs/README_EN.md`, with more detail in `docs/full-guide_EN.md`.
