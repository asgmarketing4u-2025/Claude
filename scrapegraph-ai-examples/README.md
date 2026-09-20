# Scrapegraph-ai Examples & Tools

Complete suite of examples for web scraping and lead generation using Scrapegraph-ai.

## 📁 File Structure

```
scrapegraph-ai-examples/
├── basic_scraper.py          # Simple scraping examples
├── lead_scraper.py           # Lead-focused scraper
├── advanced_scraper.py       # Enterprise-grade scraper
├── lead_database.py          # SQLite database management
├── .env.example              # Configuration template
├── sample_campaign.json       # Example campaign config
└── README.md                 # This file
```

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd /home/user/Claude/scrapegraph-ai
pip install -e .
```

### 2. Configure API Keys

```bash
# Copy environment template
cp scrapegraph-ai-examples/.env.example scrapegraph-ai-examples/.env

# Edit .env with your API keys
nano scrapegraph-ai-examples/.env
```

### 3. Run Examples

```bash
cd scrapegraph-ai-examples

# Basic scraping
python basic_scraper.py

# Lead generation
python lead_scraper.py

# Advanced campaign
python advanced_scraper.py
```

## 📚 Examples Overview

### 1. Basic Scraper (`basic_scraper.py`)

Simple introduction to Scrapegraph-ai's SmartScraperGraph.

**Features:**
- Product scraping
- Company information extraction
- Contact information retrieval

**Usage:**
```python
from basic_scraper import scrape_website

result = scrape_website(
    url="https://example.com",
    prompt="Extract all product names and prices"
)
```

### 2. Lead Scraper (`lead_scraper.py`)

Specialized scraper for generating leads from multiple sources.

**Features:**
- Scrape LinkedIn company pages
- Business directory extraction
- Job board company data
- Review site leads
- Batch processing with rate limiting
- Export to CSV/JSON
- Lead deduplication

**Usage:**
```python
from lead_scraper import LeadScraper

scraper = LeadScraper()

# Scrape LinkedIn
leads = scraper.scrape_linkedin_company_leads(
    "https://linkedin.com/company/example"
)

# Batch scrape multiple URLs
all_leads = scraper.batch_scrape(
    urls=["url1", "url2", "url3"],
    prompt="Extract business leads",
    delay=3
)

# Save results
scraper.leads = all_leads
scraper.save_to_csv("leads.csv")
scraper.save_to_json("leads.json")
```

### 3. Lead Database (`lead_database.py`)

SQLite database for persistent lead storage.

**Features:**
- Create and manage lead database
- Add/search leads
- Database statistics
- Export to CSV/JSON
- Duplicate removal
- Lead filtering

**Usage:**
```python
from lead_database import LeadDatabase

db = LeadDatabase("leads.db")

# Add a lead
lead = {
    'name': 'John Doe',
    'email': 'john@example.com',
    'company': 'Example Corp',
    'position': 'CEO',
}
db.add_lead(lead)

# Search leads
results = db.search_leads(company='Example Corp', country='USA')

# Get statistics
stats = db.get_stats()

# Export
db.export_to_csv("leads.csv")
db.export_to_json("leads.json")
```

### 4. Advanced Scraper (`advanced_scraper.py`)

Enterprise-grade scraper combining all features with campaign management.

**Features:**
- Automatic retry on failures
- Database integration
- Campaign management
- Comprehensive logging
- Statistics tracking
- Batch exports

**Usage:**
```python
from advanced_scraper import AdvancedLeadScraper

scraper = AdvancedLeadScraper(db_path="leads.db")

# Run campaign
campaign = {
    'name': 'Tech Companies',
    'sources': [
        {
            'name': 'Tech Directory',
            'urls': ['https://example.com/page1'],
            'prompt': 'Extract company information',
            'delay': 3
        }
    ]
}

stats = scraper.run_campaign(campaign)

# Export results
scraper.export_results('./exports')
```

## 🔑 API Key Configuration

### Supported LLM Providers

#### OpenAI (Recommended)
```bash
export OPENAI_API_KEY=sk-...
```

#### Mistral AI
```bash
export MISTRAL_API_KEY=...
```

#### AWS Bedrock
```bash
export AWS_ACCESS_KEY_ID=...
export AWS_SECRET_ACCESS_KEY=...
export AWS_REGION=us-east-1
```

#### Ollama (Local)
```bash
export OLLAMA_BASE_URL=http://localhost:11434
export OLLAMA_MODEL=llama2
```

#### Claude (Anthropic)
```bash
export ANTHROPIC_API_KEY=...
```

## 🎯 Common Use Cases

### 1. Generate Leads from Directory

```python
from lead_scraper import LeadScraper

scraper = LeadScraper()
leads = scraper.scrape_directory_leads("https://business-directory.com")

scraper.leads = leads
scraper.deduplicate_leads()
scraper.save_to_csv("directory_leads.csv")
```

### 2. Extract Job Board Companies

```python
from lead_scraper import LeadScraper

scraper = LeadScraper()
companies = scraper.scrape_job_board_leads("https://job-board.com")

scraper.leads = companies
scraper.save_to_json("hiring_companies.json")
```

### 3. Build Company Database

```python
from lead_database import LeadDatabase
from lead_scraper import LeadScraper

db = LeadDatabase("companies.db")
scraper = LeadScraper()

# Scrape and store
leads = scraper.scrape_directory_leads("https://example.com")
for lead in leads:
    db.add_lead(lead)

# Search
tech_companies = db.search_leads(industry='Technology')
print(f"Found {len(tech_companies)} tech companies")
```

### 4. Run Automated Campaign

```python
from advanced_scraper import AdvancedLeadScraper

scraper = AdvancedLeadScraper()

campaign = {
    'name': 'Q4 Lead Generation',
    'sources': [
        {
            'name': 'LinkedIn',
            'urls': [f'https://linkedin.com/search/results/companies/?keywords=AI&page={i}' 
                    for i in range(1, 6)],
            'prompt': 'Extract company info with contact details',
            'delay': 5
        },
        {
            'name': 'Crunchbase',
            'urls': ['https://crunchbase.com/companies?filter=ai'],
            'prompt': 'Extract startup companies with founders',
            'delay': 3
        }
    ]
}

stats = scraper.run_campaign(campaign)
print(f"Generated {stats['database']['total_leads']} leads")
```

## ⚙️ Configuration

### Environment Variables (.env)

```bash
# LLM Configuration
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-4o

# Scraping Behavior
HEADLESS_MODE=true
PAGE_TIMEOUT=30000
MAX_RETRIES=3

# Proxy (Optional)
PROXY_URL=http://proxy.example.com:8080

# Database
DATABASE_URL=sqlite:///leads.db

# Output
OUTPUT_DIR=./output
OUTPUT_FORMAT=csv
```

## 📊 Database Schema

### Leads Table
- `id`: Primary key
- `name`: Person/Business name
- `email`: Email address
- `phone`: Phone number
- `company`: Company name
- `position`: Job position
- `website`: Website URL
- `address`: Physical address
- `city`: City
- `state`: State/Province
- `country`: Country
- `industry`: Industry classification
- `linkedin_url`: LinkedIn profile
- `source_url`: Where it was scraped from
- `source_name`: Source identifier
- `rating`: Business rating
- `custom_data`: JSON for additional fields

## 🛠️ Troubleshooting

### API Key Errors
```bash
# Verify API key is set
echo $OPENAI_API_KEY

# Test in Python
from scrapegraphai.graphs import SmartScraperGraph
# Should not raise auth error
```

### Playwright Installation
```bash
# Install browsers
python -m playwright install chromium

# Verify installation
python -c "from playwright.sync_api import sync_playwright; print('OK')"
```

### Proxy Issues
```bash
# Test proxy connectivity
curl -x http://proxy:8080 https://example.com

# Update .env
PROXY_URL=http://working-proxy:8080
```

### Database Lock
```bash
# If database is locked, remove lock file
rm leads.db-wal leads.db-shm

# Then retry
python advanced_scraper.py
```

## 📈 Performance Tips

1. **Use Headless Mode**: Set `headless=True` for faster scraping
2. **Batch Processing**: Scrape multiple URLs efficiently with batch functions
3. **Rate Limiting**: Use `delay` parameter to avoid overwhelming servers
4. **Proxy Rotation**: Use proxy list for high-volume scraping
5. **Batch Database Inserts**: Use `add_leads_batch()` instead of `add_lead()` for multiple leads

## 📖 Additional Resources

- **Official Docs**: https://docs.scrapegraphai.com/
- **GitHub**: https://github.com/ScrapeGraphAI/Scrapegraph-ai
- **Examples**: `/home/user/Claude/scrapegraph-ai/examples/`

## ⚖️ Legal & Ethical Notes

- Always check website's `robots.txt` and Terms of Service
- Respect rate limits and server resources
- Use appropriate delays between requests
- Identify your scraper with proper User-Agent headers
- Don't republish copyrighted content
- Comply with GDPR, CCPA, and other privacy regulations

## 🚨 Common Issues

### Issue: "No module named 'scrapegraphai'"
**Solution**: Install the package
```bash
cd /home/user/Claude/scrapegraph-ai
pip install -e .
```

### Issue: "Playwright browser not found"
**Solution**: Install browsers
```bash
playwright install chromium
```

### Issue: "API rate limit exceeded"
**Solution**: Increase delay or use proxy
```python
# Add delay between requests
import time
time.sleep(5)

# Or use config
config = {
    "llm": {...},
    "delay": 5,
}
```

## 📝 License

These examples are provided as-is for educational purposes.
Scrapegraph-ai is licensed under MIT.

---

**Last Updated**: 2026-09-20
