from __future__ import annotations

from datetime import datetime
from typing import List

from ..models import JobPosting
from . import SourceClient


class IndeedClient(SourceClient):
    """Stub for Indeed scraping via SerpAPI or official APIs.

    Note: Implement actual API interactions using SERPAPI_API_KEY.
    """

    def search(self, query: str, location: str | None = None, days: int = 30) -> List[JobPosting]:
        # Placeholder implementation; replace with real SerpAPI calls
        return [
            JobPosting(
                source="indeed",
                company="Acme Corp",
                role_title="Operations Manager",
                location=location or "Remote",
                posted_at=datetime.utcnow(),
                post_age_days=3,
            )
        ]
