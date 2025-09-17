from __future__ import annotations

from datetime import datetime
from typing import List

from ..models import JobPosting
from . import SourceClient


class LinkedInClient(SourceClient):
    """Stub for LinkedIn job search via SerpAPI or partner APIs."""

    def search(self, query: str, location: str | None = None, days: int = 30) -> List[JobPosting]:
        return [
            JobPosting(
                source="linkedin",
                company="Beta LLC",
                role_title="Senior Accountant",
                location=location or "New York, NY",
                posted_at=datetime.utcnow(),
                post_age_days=10,
            )
        ]
