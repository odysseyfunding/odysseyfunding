from __future__ import annotations

from dataclasses import asdict
from typing import List

from .models import CompanyProfile, JobPosting, Lead


def detect_hiring_deficit(postings: List[JobPosting], company_profile: CompanyProfile) -> tuple[int, bool]:
    """Compute number of open roles and whether repeat postings/signals suggest deficit."""
    num_open_roles = len(postings)
    repeat_roles = len({p.role_title for p in postings}) < num_open_roles
    long_open = any((p.post_age_days or 0) > 30 for p in postings)
    deficit = repeat_roles or long_open or num_open_roles >= 5
    return num_open_roles, deficit


def is_established(company_profile: CompanyProfile) -> bool:
    years = company_profile.years_active or 0
    employees = company_profile.employees or 0
    departments = len(company_profile.departments or [])
    return years >= 3 and employees >= 20 and departments >= 2


def score_lead(num_open_roles: int, deficit: bool, established: bool, post_age_days_avg: float | None) -> float:
    base = 50.0
    base += min(num_open_roles * 5.0, 40.0)
    if deficit:
        base += 20.0
    if established:
        base += 15.0
    if post_age_days_avg is not None:
        # Older postings suggest potential need but reduce urgency
        base += max(0.0, 20.0 - min(post_age_days_avg, 60.0) * 0.3)
    return max(0.0, min(100.0, base))


def build_lead(company: str, postings: List[JobPosting], profile: CompanyProfile) -> Lead:
    num_open_roles, deficit = detect_hiring_deficit(postings, profile)
    established = is_established(profile)
    post_age_days_avg = None
    if postings:
        ages = [p.post_age_days for p in postings if p.post_age_days is not None]
        post_age_days_avg = (sum(ages) / len(ages)) if ages else None

    s = score_lead(num_open_roles, deficit, established, post_age_days_avg)
    first = postings[0]
    return Lead(
        company=company,
        domain=profile.domain,
        source=first.source,
        role_title=first.role_title,
        location=first.location,
        post_age_days=first.post_age_days,
        num_open_roles=num_open_roles,
        repeat_flag=deficit,
        establishment_flag=established,
        contacts=[],
        metadata={},
        score=s,
    )
