from __future__ import annotations

from src.models import CompanyProfile, JobPosting
from src.scoring import build_lead, detect_hiring_deficit, is_established, score_lead


def test_detect_hiring_deficit():
    profile = CompanyProfile(name="Acme")
    posts = [
        JobPosting(source="indeed", company="Acme", role_title="A", post_age_days=5),
        JobPosting(source="indeed", company="Acme", role_title="A", post_age_days=35),
        JobPosting(source="indeed", company="Acme", role_title="B", post_age_days=2),
    ]
    num, deficit = detect_hiring_deficit(posts, profile)
    assert num == 3
    assert deficit is True


def test_is_established():
    profile = CompanyProfile(name="Acme", years_active=4, employees=25, departments=["Ops", "Fin"])
    assert is_established(profile) is True


def test_build_lead_scores_reasonable():
    profile = CompanyProfile(name="Acme", years_active=10, employees=50, departments=["Ops", "Fin"])  
    posts = [JobPosting(source="indeed", company="Acme", role_title="Ops", post_age_days=10)]
    lead = build_lead("Acme", posts, profile)
    assert 0.0 <= (lead.score or 0) <= 100.0
