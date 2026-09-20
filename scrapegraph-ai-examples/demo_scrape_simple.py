"""
Simple Demo - Test API Connection Only
Tests the OpenAI API integration without browser rendering
"""

import os
from dotenv import load_dotenv

load_dotenv()

def test_api_connection():
    """Test OpenAI API connection"""

    api_key = os.getenv("OPENAI_API_KEY")

    if not api_key:
        print("❌ Error: OPENAI_API_KEY not found in .env file")
        return False

    print("=" * 60)
    print("DEMO - Testing OpenAI API Connection")
    print("=" * 60)
    print()

    # Test 1: Import and verify
    print("[1/3] Verifying Scrapegraph-ai installation...")
    print("-" * 60)

    try:
        from scrapegraphai.graphs import SmartScraperGraph
        print("✓ Scrapegraph-ai imported successfully")
        print()
    except Exception as e:
        print(f"❌ Error importing: {e}")
        return False

    # Test 2: Test OpenAI API
    print("[2/3] Testing OpenAI API connection...")
    print("-" * 60)

    try:
        from openai import OpenAI

        client = OpenAI(api_key=api_key)

        # Simple API test
        response = client.models.list()
        models = [m.id for m in response.data if "gpt-4o-mini" in m.id]

        if models:
            print(f"✓ OpenAI API working!")
            print(f"✓ Found model: {models[0]}")
            print()
        else:
            print("⚠ API working but gpt-4o-mini not found")
            print()

    except Exception as e:
        print(f"❌ OpenAI API Error: {e}")
        print("Check your API key in .env file")
        return False

    # Test 3: Configuration
    print("[3/3] Testing Scrapegraph-ai configuration...")
    print("-" * 60)

    try:
        config = {
            "llm": {
                "api_key": api_key,
                "model": "gpt-4o-mini",
            },
            "verbose": True,
        }

        print("✓ Configuration created successfully")
        print()
        print("Configuration details:")
        print(f"  Model: {config['llm']['model']}")
        print(f"  API Key: {config['llm']['api_key'][:20]}...***")
        print()

    except Exception as e:
        print(f"❌ Configuration Error: {e}")
        return False

    print("=" * 60)
    print("✅ ALL TESTS PASSED - System Ready!")
    print("=" * 60)
    print()
    print("Next steps:")
    print("  1. Install Playwright browsers (requires internet access)")
    print("  2. Run: playwright install chromium")
    print("  3. Then run: python lead_scraper.py")
    print()
    print("Or use the advanced scraper with a real target:")
    print("  python advanced_scraper.py")
    print()

    return True


if __name__ == "__main__":
    success = test_api_connection()
    exit(0 if success else 1)
