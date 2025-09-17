from __future__ import annotations

import os
from typing import Optional

import requests


class ZeroBounceClient:
    """Minimal ZeroBounce API client (stub-level)."""

    def __init__(self, api_key: Optional[str] = None) -> None:
        self.api_key = api_key or os.getenv("ZERObounce_API_KEY", "")

    def validate_email(self, email: str) -> str:
        """Return status string like 'valid', 'invalid', 'catch-all' (stubbed)."""
        if not self.api_key:
            return "unknown"
        # Stub: avoid network call in scaffold
        return "valid" if email and "@" in email else "invalid"
