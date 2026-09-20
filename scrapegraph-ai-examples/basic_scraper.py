"""
Basic Scrapegraph-ai scraper example
Demonstrates simple web scraping with AI-powered extraction
"""

import os
from dotenv import load_dotenv
from scrapegraphai.graphs import SmartScraperGraph

load_dotenv()


def scrape_website(url: str, prompt: str) -> dict:
    """
    Scrape a website using SmartScraperGraph

    Args:
        url: Website URL to scrape
        prompt: Natural language description of what to extract

    Returns:
        Extracted data as dictionary
    """

    graph_config = {
        "llm": {
            "api_key": os.getenv("OPENAI_API_KEY"),
            "model": "gpt-4o",
        },
        "verbose": True,
        "headless": True,  # Set to False to see the browser
    }

    try:
        scraper = SmartScraperGraph(
            prompt=prompt,
            source=url,
            config=graph_config
        )

        result = scraper.run()
        return result

    except Exception as e:
        print(f"Error scraping {url}: {e}")
        return {}


def main():
    # Example 1: Scrape product listings
    print("=" * 50)
    print("Example 1: Scraping Product Listings")
    print("=" * 50)

    product_prompt = """
    Extract all product information including:
    - Product name
    - Price
    - Description
    - Rating (if available)
    - Product URL
    """

    # Replace with actual product website
    result = scrape_website(
        url="https://example-ecommerce.com/products",
        prompt=product_prompt
    )
    print("Products extracted:", result)
    print()

    # Example 2: Scrape company information
    print("=" * 50)
    print("Example 2: Scraping Company Info")
    print("=" * 50)

    company_prompt = """
    Extract company information:
    - Company name
    - Founded year
    - Location/Headquarters
    - Number of employees
    - Website
    - LinkedIn profile
    """

    result = scrape_website(
        url="https://example-company.com/about",
        prompt=company_prompt
    )
    print("Company info extracted:", result)
    print()

    # Example 3: Scrape contact information
    print("=" * 50)
    print("Example 3: Scraping Contact Info")
    print("=" * 50)

    contact_prompt = """
    Extract all contact information:
    - Email addresses
    - Phone numbers
    - Physical address
    - Contact form URL
    - Support channels
    """

    result = scrape_website(
        url="https://example-company.com/contact",
        prompt=contact_prompt
    )
    print("Contact info extracted:", result)


if __name__ == "__main__":
    main()
