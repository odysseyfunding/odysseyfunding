from __future__ import annotations

from typing import List

from .config import load_config
from .enrich import fetch_company_profile, find_contacts
from .models import JobPosting, Lead
from .scoring import build_lead
from .sources.craigslist import CraigslistClient
from .sources.indeed import IndeedClient
from .sources.linkedin import LinkedInClient
from .storage.google_sheets import GoogleSheetsStorage


def gather_postings(query: str, location: str | None = None) -> List[JobPosting]:
    clients = [IndeedClient(), LinkedInClient(), CraigslistClient()]
    postings: List[JobPosting] = []
    for c in clients:
        postings.extend(c.search(query=query, location=location))
    return postings


def run_pipeline(query: str, location: str | None = None) -> List[Lead]:
    cfg = load_config()
    postings = gather_postings(query, location)
    leads: List[Lead] = []

    # Group by company
    company_to_postings: dict[str, List[JobPosting]] = {}
    for p in postings:
        company_to_postings.setdefault(p.company, []).append(p)

    for company, group in company_to_postings.items():
        profile = fetch_company_profile(company)
        lead = build_lead(company, group, profile)
        lead.contacts = find_contacts(company, profile.domain)
        leads.append(lead)
    return leads


def export_to_sheets(leads: List[Lead]) -> None:
    cfg = load_config()
    if not (cfg.google_service_account_json and cfg.google_sheets_spreadsheet_id):
        return
    storage = GoogleSheetsStorage(
        cfg.google_service_account_json,
        cfg.google_sheets_spreadsheet_id,
        cfg.google_sheets_worksheet,
    )
    rows = [
        {
            "company": l.company,
            "domain": l.domain,
            "source": l.source,
            "role_title": l.role_title,
            "location": l.location,
            "post_age_days": l.post_age_days,
            "num_open_roles": l.num_open_roles,
            "repeat_flag": l.repeat_flag,
            "establishment_flag": l.establishment_flag,
            "contacts": ", ".join(filter(None, [c.email or "" for c in l.contacts])),
            "score": l.score,
        }
        for l in leads
    ]
    storage.append_rows(rows)
