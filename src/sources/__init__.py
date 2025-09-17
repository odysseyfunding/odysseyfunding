from __future__ import annotations

from typing import Iterable, List

from ..models import JobPosting


class SourceClient:
    """Interface for job source clients returning normalized JobPosting entries."""

    def search(self, query: str, location: str | None = None, days: int = 30) -> List[JobPosting]:
        raise NotImplementedError
