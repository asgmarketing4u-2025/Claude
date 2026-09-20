"""
Lead Database Manager
Store and manage scraped leads in SQLite or PostgreSQL
"""

import sqlite3
import json
from datetime import datetime
from typing import List, Dict, Optional
from pathlib import Path


class LeadDatabase:
    """SQLite database for storing leads"""

    def __init__(self, db_path: str = "leads.db"):
        self.db_path = db_path
        self.init_database()

    def init_database(self):
        """Initialize database with leads table"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()

            cursor.execute('''
                CREATE TABLE IF NOT EXISTS leads (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    email TEXT,
                    phone TEXT,
                    company TEXT,
                    position TEXT,
                    website TEXT,
                    address TEXT,
                    city TEXT,
                    state TEXT,
                    country TEXT,
                    industry TEXT,
                    linkedin_url TEXT,
                    source_url TEXT,
                    source_name TEXT,
                    rating REAL,
                    notes TEXT,
                    custom_data TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(name, email, company)
                )
            ''')

            cursor.execute('''
                CREATE TABLE IF NOT EXISTS lead_sources (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    source_name TEXT UNIQUE NOT NULL,
                    source_url TEXT,
                    total_leads INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')

            cursor.execute('''
                CREATE INDEX IF NOT EXISTS idx_email ON leads(email)
            ''')

            cursor.execute('''
                CREATE INDEX IF NOT EXISTS idx_company ON leads(company)
            ''')

            cursor.execute('''
                CREATE INDEX IF NOT EXISTS idx_created ON leads(created_at)
            ''')

            conn.commit()

    def add_lead(self, lead: Dict) -> Optional[int]:
        """Add a single lead to database"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()

                cursor.execute('''
                    INSERT OR REPLACE INTO leads (
                        name, email, phone, company, position, website,
                        address, city, state, country, industry, linkedin_url,
                        source_url, source_name, rating, notes, custom_data,
                        updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    lead.get('name') or lead.get('business_name'),
                    lead.get('email'),
                    lead.get('phone'),
                    lead.get('company') or lead.get('business_name'),
                    lead.get('position') or lead.get('job_title'),
                    lead.get('website'),
                    lead.get('address'),
                    lead.get('city'),
                    lead.get('state'),
                    lead.get('country'),
                    lead.get('industry'),
                    lead.get('linkedin_url'),
                    lead.get('source_url'),
                    lead.get('source_name'),
                    lead.get('rating'),
                    lead.get('notes'),
                    json.dumps(lead.get('custom_data', {})),
                    datetime.now().isoformat()
                ))

                conn.commit()
                return cursor.lastrowid

        except Exception as e:
            print(f"Error adding lead: {e}")
            return None

    def add_leads_batch(self, leads: List[Dict]) -> int:
        """Add multiple leads efficiently"""
        count = 0
        for lead in leads:
            if self.add_lead(lead):
                count += 1
        return count

    def get_lead_by_email(self, email: str) -> Optional[Dict]:
        """Retrieve lead by email"""
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()

            cursor.execute('SELECT * FROM leads WHERE email = ?', (email,))
            row = cursor.fetchone()

            return dict(row) if row else None

    def search_leads(self, **criteria) -> List[Dict]:
        """Search leads by various criteria"""
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()

            query = 'SELECT * FROM leads WHERE 1=1'
            params = []

            if 'company' in criteria:
                query += ' AND company LIKE ?'
                params.append(f"%{criteria['company']}%")

            if 'industry' in criteria:
                query += ' AND industry = ?'
                params.append(criteria['industry'])

            if 'country' in criteria:
                query += ' AND country = ?'
                params.append(criteria['country'])

            if 'email' in criteria:
                query += ' AND email LIKE ?'
                params.append(f"%{criteria['email']}%")

            if 'position' in criteria:
                query += ' AND position LIKE ?'
                params.append(f"%{criteria['position']}%")

            cursor.execute(query, params)
            return [dict(row) for row in cursor.fetchall()]

    def get_all_leads(self, limit: int = None) -> List[Dict]:
        """Retrieve all leads"""
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()

            query = 'SELECT * FROM leads ORDER BY created_at DESC'
            if limit:
                query += f' LIMIT {limit}'

            cursor.execute(query)
            return [dict(row) for row in cursor.fetchall()]

    def get_leads_by_source(self, source_name: str) -> List[Dict]:
        """Get all leads from a specific source"""
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()

            cursor.execute(
                'SELECT * FROM leads WHERE source_name = ? ORDER BY created_at DESC',
                (source_name,)
            )
            return [dict(row) for row in cursor.fetchall()]

    def get_stats(self) -> Dict:
        """Get database statistics"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()

            cursor.execute('SELECT COUNT(*) FROM leads')
            total_leads = cursor.fetchone()[0]

            cursor.execute('SELECT COUNT(DISTINCT email) FROM leads WHERE email IS NOT NULL')
            unique_emails = cursor.fetchone()[0]

            cursor.execute('SELECT COUNT(DISTINCT company) FROM leads WHERE company IS NOT NULL')
            unique_companies = cursor.fetchone()[0]

            cursor.execute('SELECT COUNT(DISTINCT source_name) FROM leads')
            sources = cursor.fetchone()[0]

            cursor.execute('''
                SELECT source_name, COUNT(*) as count
                FROM leads GROUP BY source_name ORDER BY count DESC
            ''')
            source_breakdown = {row[0]: row[1] for row in cursor.fetchall()}

            return {
                'total_leads': total_leads,
                'unique_emails': unique_emails,
                'unique_companies': unique_companies,
                'sources': sources,
                'source_breakdown': source_breakdown,
            }

    def export_to_csv(self, filepath: str) -> bool:
        """Export leads to CSV"""
        try:
            import csv

            leads = self.get_all_leads()
            if not leads:
                print("No leads to export")
                return False

            with open(filepath, 'w', newline='', encoding='utf-8') as f:
                writer = csv.DictWriter(f, fieldnames=leads[0].keys())
                writer.writeheader()
                writer.writerows(leads)

            print(f"Exported {len(leads)} leads to {filepath}")
            return True

        except Exception as e:
            print(f"Error exporting to CSV: {e}")
            return False

    def export_to_json(self, filepath: str) -> bool:
        """Export leads to JSON"""
        try:
            leads = self.get_all_leads()

            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(leads, f, indent=2, ensure_ascii=False, default=str)

            print(f"Exported {len(leads)} leads to {filepath}")
            return True

        except Exception as e:
            print(f"Error exporting to JSON: {e}")
            return False

    def delete_old_leads(self, days: int = 30) -> int:
        """Delete leads older than specified days"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()

            cursor.execute('''
                DELETE FROM leads
                WHERE created_at < datetime('now', '-' || ? || ' days')
            ''', (days,))

            conn.commit()
            return cursor.rowcount

    def remove_duplicates(self) -> int:
        """Remove duplicate leads based on email"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()

            cursor.execute('''
                DELETE FROM leads WHERE id NOT IN (
                    SELECT MIN(id) FROM leads
                    WHERE email IS NOT NULL
                    GROUP BY email
                )
            ''')

            conn.commit()
            return cursor.rowcount


def main():
    """Example usage"""

    # Initialize database
    db = LeadDatabase("leads.db")

    print("=" * 60)
    print("LEAD DATABASE - Example")
    print("=" * 60)

    # Add sample lead
    sample_lead = {
        'name': 'John Doe',
        'email': 'john@example.com',
        'phone': '+1-555-0123',
        'company': 'Example Corp',
        'position': 'CEO',
        'website': 'https://example.com',
        'city': 'New York',
        'country': 'USA',
        'industry': 'Technology',
        'source_name': 'LinkedIn',
        'source_url': 'https://linkedin.com/company/example',
    }

    lead_id = db.add_lead(sample_lead)
    print(f"\nAdded lead with ID: {lead_id}")

    # Get statistics
    stats = db.get_stats()
    print(f"\nDatabase Statistics:")
    print(f"  Total Leads: {stats['total_leads']}")
    print(f"  Unique Emails: {stats['unique_emails']}")
    print(f"  Unique Companies: {stats['unique_companies']}")
    print(f"  Sources: {stats['sources']}")

    # Search leads
    results = db.search_leads(company='Example Corp')
    print(f"\nSearch results for 'Example Corp': {len(results)} leads")

    # Export
    db.export_to_csv("leads_export.csv")
    db.export_to_json("leads_export.json")

    print("\n" + "=" * 60)
    print("✓ Database operations completed!")
    print("=" * 60)


if __name__ == "__main__":
    main()
