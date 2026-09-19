# Scrapegraph-ai Installation Guide

## 📋 System Requirements

- **Python**: 3.12+ (You currently have 3.11.15 - you'll need to upgrade)
- **Operating System**: Linux/Mac/Windows
- **Disk Space**: ~500MB for dependencies

## 🔧 Installation Steps

### Step 1: Upgrade Python to 3.12+

Since you're running Python 3.11, you need to upgrade. Options:

**Option A: Using apt (Ubuntu/Debian)**
```bash
sudo apt-get update
sudo apt-get install python3.12 python3.12-venv python3.12-dev
```

**Option B: Using pyenv (Recommended for multiple Python versions)**
```bash
curl https://pyenv.run | bash
pyenv install 3.12.0
pyenv global 3.12.0
```

**Option C: Download from python.org**
Visit https://www.python.org/downloads/ and download Python 3.12+

### Step 2: Create a Virtual Environment

After upgrading to Python 3.12+:

```bash
cd /home/user/Claude/scrapegraph-ai
python3.12 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### Step 3: Install Scrapegraph-ai

```bash
# Install in development mode
pip install -e .

# Or install with optional dependencies:
# OCR support
pip install -e ".[ocr]"

# NVIDIA GPU support
pip install -e ".[nvidia]"
```

### Step 4: Set Up Environment Variables

Create a `.env` file in the scrapegraph-ai directory:

```bash
# .env file in /home/user/Claude/scrapegraph-ai/.env

# OpenAI (for ChatGPT scraping)
OPENAI_API_KEY=your_openai_api_key_here

# Mistral AI
MISTRAL_API_KEY=your_mistral_api_key_here

# AWS Credentials (for Bedrock)
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=us-east-1

# Ollama (for local LLM)
OLLAMA_BASE_URL=http://localhost:11434

# Optional: Proxy settings
# PROXY_URL=http://proxy.example.com:8080
```

## 📖 Quick Start Example

After installation, test with this Python script (`test_scrape.py`):

```python
from scrapegraphai.graphs import SmartScraperGraph

# Define your scraping target
graph_config = {
    "llm": {
        "api_key": "your_openai_api_key",
        "model": "gpt-4o",
    },
    "verbose": True,
    "headless": False,
}

# Create scraper
scraper = SmartScraperGraph(
    prompt="Find all product names and prices",
    source="https://example.com",
    config=graph_config
)

# Run scraper
result = scraper.run()
print(result)
```

## 🎯 Key Features

### 1. SmartScraperGraph
For intelligent data extraction from any website:
```python
from scrapegraphai.graphs import SmartScraperGraph

graph_config = {
    "llm": {"api_key": "...", "model": "gpt-4o"},
    "headless": False,
}

scraper = SmartScraperGraph(
    prompt="Extract all email addresses and names",
    source="https://company.com/team",
    config=graph_config
)

result = scraper.run()
```

### 2. Supported LLM Providers
- **OpenAI** (GPT-4, GPT-4o)
- **Mistral AI**
- **AWS Bedrock**
- **Ollama** (local/open-source models)
- **Claude** (Anthropic)

### 3. Advanced Features
- **Browser Automation**: Using Playwright for JavaScript-heavy sites
- **Proxy Support**: Built-in proxy rotation
- **OCR**: Extract text from images
- **Custom Agents**: Build your own scraping workflows

## 📁 Project Structure

```
scrapegraph-ai/
├── scrapegraphai/          # Main package
│   ├── agents/             # LLM agents
│   ├── graphs/             # Scraping graphs
│   ├── models/             # Data models
│   └── utils/              # Utility functions
├── examples/               # Example scripts
├── tests/                  # Test suite
├── README.md               # Official documentation
└── pyproject.toml          # Project configuration
```

## 🚀 Next Steps

1. **Upgrade Python** to 3.12+
2. **Create virtual environment** as shown above
3. **Install dependencies**: `pip install -e .`
4. **Set up API keys** in `.env`
5. **Run examples** from the `examples/` directory
6. **Start scraping!**

## 📚 Resources

- **Official Docs**: https://docs.scrapegraphai.com/
- **GitHub Repository**: https://github.com/ScrapeGraphAI/Scrapegraph-ai
- **Examples**: `/home/user/Claude/scrapegraph-ai/examples/`

## ✅ Verification

To verify installation is working:

```bash
cd /home/user/Claude/scrapegraph-ai
python -c "from scrapegraphai.graphs import SmartScraperGraph; print('✓ Installation successful!')"
```

## 🆘 Troubleshooting

**Issue**: "Python 3.12+ required"
- **Solution**: Upgrade Python using the steps above

**Issue**: Playwright browser not installed
- **Solution**: Run `playwright install chromium`

**Issue**: API key errors
- **Solution**: Verify `.env` file exists and has correct API keys

**Issue**: Import errors
- **Solution**: Make sure virtual environment is activated and package is installed with `pip install -e .`

## 💡 Tips for Lead Generation

To scrape unlimited leads with Scrapegraph-ai:

1. **Use SmartScraperGraph** for automatic data extraction
2. **Set up proxy rotation** to avoid IP blocks
3. **Use headless mode** for faster scraping: `"headless": True`
4. **Implement rate limiting** to respect server resources
5. **Store results** in database or CSV for processing

Example lead scraper:
```python
from scrapegraphai.graphs import SmartScraperGraph

config = {
    "llm": {"api_key": "...", "model": "gpt-4o"},
    "headless": True,
    "verbose": True,
}

for url in lead_urls:
    scraper = SmartScraperGraph(
        prompt="Extract company name, email, phone, and contact person",
        source=url,
        config=config
    )
    leads = scraper.run()
    # Process and store leads...
```

---

**Last Updated**: 2026-09-19
