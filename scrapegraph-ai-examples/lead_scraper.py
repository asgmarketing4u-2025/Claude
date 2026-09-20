"""
Lead Generation Scraper
Extracts unlimited leads from multiple sources
"""

import os
import json
import time
import csv
from datetime import datetime
from typing import List, Dict
from dotenv import load_dotenv
from scrapegraphai.graphs import SmartScraperGraph

load_dotenv()


class LeadScraper:
    """Multi-source lead scraper using Scrapegraph-ai"""

    def __init__(self, api_key: str = None, model: str = "gpt-4o", headless: bool = True):
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        self.model = model
        self.headless = headless
        self.leads = []

    def get_config(self, use_proxy: str = None) -> dict:
        """Generate scraper configuration"""
        config = {
            "llm": {
                "api_key": self.api_key,
                "model": self.model,
            },
            "verbose": True,
            "headless": self.headless,
        }

        if use_proxy:
            config["proxy"] = {"server": use_proxy}

        return config

    def scrape_leads(self, url: str, prompt: str, proxy: str = None) -> List[Dict]:
        """
        Scrape leads from a single URL

        Args:
            url: Target URL
            prompt: Extraction prompt
            proxy: Optional proxy URL

        Returns:
            List of extracted leads
        """
        try:
            scraper = SmartScraperGraph(
                prompt=prompt,
                source=url,
                config=self.get_config(proxy)
            )

            result = scraper.run()

            if isinstance(result, list):
                return result
            elif isinstance(result, dict):
                return [result]
            else:
                return []

        except Exception as e:
            print(f"Error scraping {url}: {e}")
            return []

    def scrape_linkedin_company_leads(self, company_url: str) -> List[Dict]:
        """Scrape leads from LinkedIn company page"""
        prompt = """
        Extract employee information from this LinkedIn company page:
        - Employee name
        - Job title
        - Department
        - LinkedIn profile URL
        - Contact email (if visible)

        Return as a list of employee objects.
        """

        return self.scrape_leads(company_url, prompt)

    def scrape_directory_leads(self, directory_url: str) -> List[Dict]:
        """Scrape leads from business directory"""
        prompt = """
        Extract all business listings with:
        - Business name
        - Industry/Category
        - Address
        - Phone number
        - Website
        - Email
        - Business description

        Return as a list of business objects.
        """

        return self.scrape_leads(directory_url, prompt)

    def scrape_job_board_leads(self, job_board_url: str) -> List[Dict]:
        """Scrape leads from job boards (company hiring info)"""
        prompt = """
        Extract hiring company information:
        - Company name
        - Job title(s)
        - Company website
        - Company email/contact
        - Location
        - Industry

        Return as a list of company objects.
        """

        return self.scrape_leads(job_board_url, prompt)

    def scrape_review_site_leads(self, review_url: str) -> List[Dict]:
        """Scrape leads from business review sites"""
        prompt = """
        Extract business information from reviews:
        - Business name
        - Owner/Manager name
        - Business email
        - Phone
        - Website
        - Address
        - Average rating
        - Number of reviews

        Return as a list of business objects.
        """

        return self.scrape_leads(review_url, prompt)

    def batch_scrape(self, urls: List[str], prompt: str, delay: int = 2) -> List[Dict]:
        """
        Scrape multiple URLs with rate limiting

        Args:
            urls: List of URLs to scrape
            prompt: Extraction prompt
            delay: Delay between requests (seconds)

        Returns:
            Combined list of all leads
        """
        all_leads = []

        for i, url in enumerate(urls, 1):
            print(f"\n[{i}/{len(urls)}] Scraping: {url}")

            leads = self.scrape_leads(url, prompt)
            all_leads.extend(leads)

            # Rate limiting
            if i < len(urls):
                print(f"Waiting {delay}s before next request...")
                time.sleep(delay)

        return all_leads

    def save_to_csv(self, filepath: str = "leads.csv") -> str:
        """Save leads to CSV file"""
        if not self.leads:
            print("No leads to save")
            return None

        keys = self.leads[0].keys()

        with open(filepath, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=keys)
            writer.writeheader()
            writer.writerows(self.leads)

        print(f"Saved {len(self.leads)} leads to {filepath}")
        return filepath

    def save_to_json(self, filepath: str = "leads.json") -> str:
        """Save leads to JSON file"""
        if not self.leads:
            print("No leads to save")
            return None

        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(self.leads, f, indent=2, ensure_ascii=False)

        print(f"Saved {len(self.leads)} leads to {filepath}")
        return filepath

    def deduplicate_leads(self) -> None:
        """Remove duplicate leads based on key identifiers"""
        seen = set()
        unique_leads = []

        for lead in self.leads:
            # Use email or name as identifier
            identifier = (lead.get('email', ''), lead.get('name', '') or lead.get('business_name', ''))

            if identifier not in seen:
                seen.add(identifier)
                unique_leads.append(lead)

        original_count = len(self.leads)
        self.leads = unique_leads

        print(f"Deduplicated: {original_count} → {len(self.leads)} leads")

    def filter_leads(self, criteria: Dict) -> List[Dict]:
        """
        Filter leads by criteria

        Args:
            criteria: Dict with keys and values to match

        Returns:
            Filtered leads
        """
        filtered = self.leads

        for key, value in criteria.items():
            filtered = [
                lead for lead in filtered
                if lead.get(key, '').lower() == str(value).lower()
            ]

        return filtered


def main():
    """Example usage of LeadScraper"""

    # Initialize scraper
    scraper = LeadScraper(headless=True)

    print("=" * 60)
    print("LEAD SCRAPER - Scrapegraph-ai Example")
    print("=" * 60)

    # Example 1: Scrape from directory
    print("\n[1] Scraping from Business Directory")
    print("-" * 60)

    directory_leads = scraper.scrape_directory_leads(
        "https://example-directory.com/businesses"
    )
    scraper.leads.extend(directory_leads)
    print(f"Found {len(directory_leads)} leads from directory")

    # Example 2: Scrape from LinkedIn (company)
    print("\n[2] Scraping from LinkedIn Company Page")
    print("-" * 60)

    linkedin_leads = scraper.scrape_linkedin_company_leads(
        "https://linkedin.com/company/example-company"
    )
    scraper.leads.extend(linkedin_leads)
    print(f"Found {len(linkedin_leads)} leads from LinkedIn")

    # Example 3: Batch scrape multiple URLs
    print("\n[3] Batch Scraping Multiple Sites")
    print("-" * 60)

    urls_to_scrape = [
        "https://example1.com/directory",
        "https://example2.com/listings",
        "https://example3.com/companies",
    ]

    batch_leads = scraper.batch_scrape(
        urls=urls_to_scrape,
        prompt="Extract all business leads with name, email, phone, and website",
        delay=3
    )
    scraper.leads.extend(batch_leads)
    print(f"Found {len(batch_leads)} leads from batch scrape")

    # Process leads
    print("\n[4] Processing Leads")
    print("-" * 60)

    print(f"Total leads collected: {len(scraper.leads)}")

    # Deduplicate
    scraper.deduplicate_leads()

    # Filter by criteria (example)
    us_leads = scraper.filter_leads({"country": "USA"})
    print(f"US-based leads: {len(us_leads)}")

    # Save results
    print("\n[5] Saving Results")
    print("-" * 60)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    scraper.save_to_csv(f"leads_{timestamp}.csv")
    scraper.save_to_json(f"leads_{timestamp}.json")

    print("\n" + "=" * 60)
    print("✓ Lead scraping completed!")
    print("=" * 60)


if __name__ == "__main__":
    main()
