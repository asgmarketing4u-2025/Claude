# Local Setup Guide - Scrapegraph-ai

The remote cloud environment has network restrictions that prevent connecting to external APIs. To run the scrapers, you'll need to set up on your local machine.

## ✅ What's Ready

All code, examples, and configuration templates are prepared in your GitHub repository:
- ✅ Scrapegraph-ai v2.2.4 cloned
- ✅ 4 scraper scripts ready (basic, lead, advanced, demo)
- ✅ Database manager created
- ✅ Configuration templates prepared
- ✅ Comprehensive documentation included

## 🚀 Local Setup Steps

### Step 1: Clone Your Repository

```bash
git clone https://github.com/asgmarketing4u-2025/Claude.git
cd Claude
git checkout claude/scrapegraph-ai-install-52whga
```

### Step 2: Upgrade Python to 3.12+

**On macOS (using Homebrew):**
```bash
brew install python@3.12
```

**On Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install python3.12 python3.12-venv python3.12-dev
```

**On Windows:**
Download from https://www.python.org/downloads/

### Step 3: Create Virtual Environment

```bash
cd scrapegraph-ai
python3.12 -m venv venv

# Activate virtual environment
# On macOS/Linux:
source venv/bin/activate

# On Windows:
venv\Scripts\activate
```

### Step 4: Install Scrapegraph-ai

```bash
pip install --upgrade pip setuptools wheel
pip install -e .
```

### Step 5: Install Playwright Browsers

```bash
playwright install chromium
```

### Step 6: Configure API Keys

```bash
cd ../scrapegraph-ai-examples
cp .env.example .env

# Edit .env with your editor
nano .env  # or use your preferred editor
```

Add your OpenAI API key:
```
OPENAI_API_KEY=sk-proj-YOUR_NEW_KEY_HERE
```

### Step 7: Run the Demo

```bash
# Test API connection and configuration
python demo_scrape_simple.py

# Run full demo with browser rendering
python demo_scrape.py

# Start with lead generation
python lead_scraper.py

# Or run advanced campaign
python advanced_scraper.py
```

## 📁 Project Structure

```
Claude/
├── scrapegraph-ai/              # Main package directory
│   ├── venv/                    # Virtual environment (local only)
│   ├── scrapegraphai/           # Source code
│   ├── examples/                # Official examples
│   └── pyproject.toml           # Package configuration
│
├── scrapegraph-ai-examples/     # Your custom examples
│   ├── basic_scraper.py         # Simple examples
│   ├── lead_scraper.py          # Lead generation
│   ├── advanced_scraper.py      # Enterprise-grade
│   ├── lead_database.py         # Database manager
│   ├── demo_scrape.py           # Full demo
│   ├── demo_scrape_simple.py    # API test only
│   ├── .env.example             # Configuration template
│   ├── .env                     # Your actual config (DO NOT COMMIT)
│   ├── .gitignore               # Security settings
│   ├── README.md                # Complete guide
│   └── sample_campaign.json     # Example campaign
│
└── SCRAPEGRAPH_SETUP.md         # Installation guide
```

## 🔑 API Key Setup

1. Get a new OpenAI API key from https://platform.openai.com/account/api-keys
2. Add to `.env` file:
   ```
   OPENAI_API_KEY=sk-proj-YOUR_KEY
   ```
3. Never commit `.env` to git (it's in `.gitignore`)
4. Use gpt-4o-mini for testing (cheaper than gpt-4o)

## 📚 Usage Examples

### Basic Scraping

```bash
python basic_scraper.py
```

### Generate Leads

```bash
python lead_scraper.py
```

### Run Campaign

```bash
python advanced_scraper.py
```

### Database Operations

```python
from lead_database import LeadDatabase

db = LeadDatabase("leads.db")
leads = db.search_leads(company="Example Corp")
db.export_to_csv("leads.csv")
```

## 🛠️ Troubleshooting

### "No module named 'scrapegraphai'"
- Make sure virtual environment is activated
- Reinstall: `pip install -e .`

### "Playwright browser not found"
- Run: `playwright install chromium`

### "API rate limit exceeded"
- Add delay between requests
- Use proxy rotation
- Upgrade OpenAI account

### "Connection refused"
- Check your API key in `.env`
- Verify internet connection
- Check firewall settings

## 💡 Tips

1. **Test First**: Run `demo_scrape.py` to verify setup
2. **Use Mini Model**: gpt-4o-mini is cheaper for testing
3. **Rate Limiting**: Use delays between requests to avoid blocks
4. **Database**: Store leads in SQLite for persistence
5. **Export**: Use CSV/JSON for data analysis

## 🎯 Next Steps

1. Clone repository locally
2. Set up Python 3.12+ virtual environment
3. Install dependencies
4. Add your OpenAI API key to `.env`
5. Run demo to verify
6. Start scraping!

## 📖 Resources

- **Scrapegraph-ai Docs**: https://docs.scrapegraphai.com/
- **OpenAI API**: https://platform.openai.com/docs/
- **GitHub Repository**: https://github.com/ScrapeGraphAI/Scrapegraph-ai

## ✨ You're All Set!

Everything is configured and ready to go. Just clone, set up locally, and start scraping unlimited leads! 🕷️

---

**Last Updated**: 2026-09-20
