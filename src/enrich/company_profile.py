from __future__ import annotations

from typing import Optional

from ..models import CompanyProfile


def fetch_company_profile(company: str) -> CompanyProfile:
    """Stub: Look up domain, industry, employees, revenue, years_active.

    Replace with Clearbit/SerpAPI or other enrichment sources.
    """
    return CompanyProfile(
        name=company,
        domain=f"{company.lower().replace(' ', '')}.com",
        industry="Unknown",
        employees=150,
        revenue=10_000_000.0,
        years_active=7,
        departments=["Operations", "Finance", "Sales"],
    )
