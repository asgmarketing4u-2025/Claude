"""
Advanced Lead Scraper
Complete solution combining Scrapegraph-ai with database management
"""

import os
import sys
import json
import logging
from datetime import datetime
from typing import List, Dict, Optional
from pathlib import Path
from dotenv import load_dotenv

from scrapegraphai.graphs import SmartScraperGraph
from lead_database import LeadDatabase

load_dotenv()

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('scraper.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


class AdvancedLeadScraper:
    """Enterprise-grade lead scraper with database integration"""

    def __init__(
        self,
        db_path: str = "leads.db",
        api_key: str = None,
        model: str = "gpt-4o",
        headless: bool = True,
        max_retries: int = 3
    ):
        self.db = LeadDatabase(db_path)
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        self.model = model
        self.headless = headless
        self.max_retries = max_retries
        self.scraped_count = 0
        self.error_count = 0

        logger.info(f"Initialized AdvancedLeadScraper")

    def scrape_with_retry(
        self,
        url: str,
        prompt: str,
        proxy: str = None,
        retry_count: int = 0
    ) -> Optional[Dict]:
        """Scrape with automatic retry on failure"""

        try:
            config = {
                "llm": {
                    "api_key": self.api_key,
                    "model": self.model,
                },
                "verbose": False,
                "headless": self.headless,
            }

            if proxy:
                config["proxy"] = {"server": proxy}

            logger.info(f"Scraping: {url} (Attempt {retry_count + 1})")

            scraper = SmartScraperGraph(
                prompt=prompt,
                source=url,
                config=config
            )

            result = scraper.run()
            logger.info(f"✓ Successfully scraped: {url}")
            self.scraped_count += 1

            return result

        except Exception as e:
            self.error_count += 1
            logger.warning(f"✗ Error scraping {url}: {e}")

            if retry_count < self.max_retries:
                logger.info(f"Retrying... ({retry_count + 1}/{self.max_retries})")
                return self.scrape_with_retry(url, prompt, proxy, retry_count + 1)
            else:
                logger.error(f"Failed after {self.max_retries} retries: {url}")
                return None

    def process_leads(
        self,
        raw_data: any,
        source_name: str,
        source_url: str
    ) -> List[Dict]:
        """Convert raw scraped data to lead objects"""

        leads = []

        if isinstance(raw_data, list):
            leads = raw_data
        elif isinstance(raw_data, dict):
            leads = [raw_data]
        else:
            logger.warning(f"Unexpected data type: {type(raw_data)}")
            return []

        # Add metadata
        for lead in leads:
            if isinstance(lead, dict):
                lead['source_name'] = source_name
                lead['source_url'] = source_url
                lead['scraped_at'] = datetime.now().isoformat()

        return leads

    def scrape_and_store(
        self,
        url: str,
        prompt: str,
        source_name: str,
        proxy: str = None
    ) -> int:
        """Scrape and directly store leads in database"""

        result = self.scrape_with_retry(url, prompt, proxy)

        if result is None:
            return 0

        leads = self.process_leads(result, source_name, url)
        return self.db.add_leads_batch(leads)

    def scrape_multiple(
        self,
        urls: List[str],
        prompt: str,
        source_name: str,
        delay: int = 2
    ) -> int:
        """Scrape multiple URLs and store results"""

        import time

        total_added = 0

        for i, url in enumerate(urls, 1):
            print(f"\n[{i}/{len(urls)}] {url}")

            added = self.scrape_and_store(url, prompt, source_name)
            total_added += added

            if i < len(urls):
                logger.info(f"Waiting {delay}s before next request...")
                time.sleep(delay)

        return total_added

    def run_campaign(self, campaign_config: Dict) -> Dict:
        """Run a complete scraping campaign"""

        logger.info(f"Starting campaign: {campaign_config['name']}")

        campaign_name = campaign_config['name']
        sources = campaign_config['sources']

        campaign_stats = {
            'name': campaign_name,
            'started_at': datetime.now().isoformat(),
            'sources': {}
        }

        for source in sources:
            logger.info(f"\nProcessing source: {source['name']}")

            urls = source.get('urls', [])
            prompt = source.get('prompt', '')

            added = self.scrape_multiple(
                urls=urls,
                prompt=prompt,
                source_name=source['name'],
                delay=source.get('delay', 2)
            )

            campaign_stats['sources'][source['name']] = {
                'leads_added': added,
                'urls_processed': len(urls)
            }

        campaign_stats['completed_at'] = datetime.now().isoformat()
        campaign_stats['total_scraped'] = self.scraped_count
        campaign_stats['total_errors'] = self.error_count

        logger.info(f"Campaign completed: {campaign_stats}")

        return campaign_stats

    def get_statistics(self) -> Dict:
        """Get comprehensive scraping statistics"""

        db_stats = self.db.get_stats()

        return {
            'database': db_stats,
            'scraper': {
                'total_scraped': self.scraped_count,
                'errors': self.error_count,
            },
            'generated_at': datetime.now().isoformat()
        }

    def export_results(self, export_dir: str = "./exports") -> Dict:
        """Export all leads and statistics"""

        Path(export_dir).mkdir(exist_ok=True)

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

        # Export leads
        csv_file = f"{export_dir}/leads_{timestamp}.csv"
        json_file = f"{export_dir}/leads_{timestamp}.json"
        stats_file = f"{export_dir}/stats_{timestamp}.json"

        self.db.export_to_csv(csv_file)
        self.db.export_to_json(json_file)

        # Export statistics
        stats = self.get_statistics()
        with open(stats_file, 'w') as f:
            json.dump(stats, f, indent=2)

        logger.info(f"Results exported to {export_dir}")

        return {
            'csv': csv_file,
            'json': json_file,
            'stats': stats_file
        }


def load_campaign_config(config_file: str) -> Dict:
    """Load campaign configuration from JSON"""

    with open(config_file, 'r') as f:
        return json.load(f)


def main():
    """Example campaign"""

    print("\n" + "=" * 70)
    print("ADVANCED LEAD SCRAPER - Scrapegraph-ai")
    print("=" * 70)

    # Initialize scraper
    scraper = AdvancedLeadScraper(
        db_path="leads_campaign.db",
        headless=True,
        max_retries=3
    )

    # Define campaign
    campaign = {
        'name': 'Tech Companies Lead Generation',
        'sources': [
            {
                'name': 'Tech Directory',
                'urls': [
                    'https://example-tech-directory.com/page1',
                    'https://example-tech-directory.com/page2',
                ],
                'prompt': '''
                    Extract all technology company leads:
                    - Company name
                    - Industry (technology/SaaS/etc)
                    - Website
                    - Contact email
                    - CEO/Founder name
                    - Number of employees
                    - Funding status
                ''',
                'delay': 3
            },
            {
                'name': 'LinkedIn Companies',
                'urls': [
                    'https://linkedin.com/search/results/companies/?keywords=AI',
                    'https://linkedin.com/search/results/companies/?keywords=SaaS',
                ],
                'prompt': '''
                    Extract company information:
                    - Company name
                    - LinkedIn profile URL
                    - Founded year
                    - Company size
                    - Industry
                    - Company website
                ''',
                'delay': 3
            },
            {
                'name': 'Business Reviews',
                'urls': [
                    'https://example-reviews.com/tech-companies',
                ],
                'prompt': '''
                    Extract business leads with ratings:
                    - Business name
                    - Contact information
                    - Website
                    - Average rating
                    - Review count
                ''',
                'delay': 2
            }
        ]
    }

    # Run campaign
    try:
        logger.info("Starting campaign...")
        stats = scraper.run_campaign(campaign)

        # Display results
        print("\n" + "-" * 70)
        print("CAMPAIGN RESULTS")
        print("-" * 70)

        for source_name, source_stats in stats['sources'].items():
            print(f"\n{source_name}:")
            print(f"  Leads Added: {source_stats['leads_added']}")
            print(f"  URLs Processed: {source_stats['urls_processed']}")

        print(f"\nTotal Scraped: {stats['total_scraped']}")
        print(f"Errors: {stats['total_errors']}")

        # Get database statistics
        db_stats = scraper.get_statistics()['database']
        print(f"\nDatabase Statistics:")
        print(f"  Total Leads: {db_stats['total_leads']}")
        print(f"  Unique Emails: {db_stats['unique_emails']}")
        print(f"  Unique Companies: {db_stats['unique_companies']}")

        # Export results
        print("\nExporting results...")
        exports = scraper.export_results()
        print(f"  CSV: {exports['csv']}")
        print(f"  JSON: {exports['json']}")
        print(f"  Stats: {exports['stats']}")

        print("\n" + "=" * 70)
        print("✓ Campaign completed successfully!")
        print("=" * 70 + "\n")

    except KeyboardInterrupt:
        logger.warning("Campaign interrupted by user")
    except Exception as e:
        logger.error(f"Campaign failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
