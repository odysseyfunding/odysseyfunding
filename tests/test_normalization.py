from __future__ import annotations

from src.models import JobPosting


def test_job_posting_dataclass_defaults():
    jp = JobPosting(source="indeed", company="Acme", role_title="Ops")
    assert jp.location is None
    assert jp.post_age_days is None
