"""
Quick Demo - Scrapegraph-ai Pipeline Test
Tests the scraping pipeline with a small, safe example
"""

import os
from dotenv import load_dotenv
from scrapegraphai.graphs import SmartScraperGraph

load_dotenv()

def demo_scrape():
    """Run a simple demo scrape"""

    api_key = os.getenv("OPENAI_API_KEY")

    if not api_key:
        print("❌ Error: OPENAI_API_KEY not found in .env file")
        print("Please add your API key to .env and try again")
        return False

    print("=" * 60)
    print("DEMO SCRAPE - Testing Scrapegraph-ai Pipeline")
    print("=" * 60)
    print()

    # Configuration using gpt-4o-mini (cheaper for testing)
    config = {
        "llm": {
            "api_key": api_key,
            "model": "gpt-4o-mini",
        },
        "verbose": True,
        "headless": True,
    }

    # Demo 1: Scrape a simple static page
    print("[1/3] Testing basic scraping...")
    print("-" * 60)

    try:
        scraper = SmartScraperGraph(
            prompt="Extract the page title and main heading",
            source="https://example.com",
            config=config
        )

        result = scraper.run()
        print("✓ Result:", result)
        print()

    except Exception as e:
        print(f"❌ Error: {e}")
        return False

    # Demo 2: Extract structured data
    print("[2/3] Testing structured data extraction...")
    print("-" * 60)

    try:
        scraper = SmartScraperGraph(
            prompt="""
            Extract information about this website:
            - Page title
            - Main heading
            - Description/Purpose
            - Key sections mentioned
            """,
            source="https://example.com",
            config=config
        )

        result = scraper.run()
        print("✓ Result:", result)
        print()

    except Exception as e:
        print(f"❌ Error: {e}")
        return False

    # Demo 3: Test with different prompt
    print("[3/3] Testing different extraction style...")
    print("-" * 60)

    try:
        scraper = SmartScraperGraph(
            prompt="List all text content on this page in bullet points",
            source="https://example.com",
            config=config
        )

        result = scraper.run()
        print("✓ Result:", result)
        print()

    except Exception as e:
        print(f"❌ Error: {e}")
        return False

    print("=" * 60)
    print("✅ DEMO COMPLETE - Pipeline is working!")
    print("=" * 60)
    print()
    print("Next steps:")
    print("  1. Try with a real target website")
    print("  2. Use lead_scraper.py for lead generation")
    print("  3. Run advanced_scraper.py for campaigns")
    print()

    return True


if __name__ == "__main__":
    success = demo_scrape()
    exit(0 if success else 1)
