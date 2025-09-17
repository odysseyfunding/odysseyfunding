from __future__ import annotations

from datetime import datetime
from typing import List

from ..models import JobPosting
from . import SourceClient


class CraigslistClient(SourceClient):
    """Stub for Craigslist job search (may require scraping within ToS)."""

    def search(self, query: str, location: str | None = None, days: int = 30) -> List[JobPosting]:
        return [
            JobPosting(
                source="craigslist",
                company="Gamma Services",
                role_title="Dispatcher",
                location=location or "Los Angeles, CA",
                posted_at=datetime.utcnow(),
                post_age_days=21,
            )
        ]
