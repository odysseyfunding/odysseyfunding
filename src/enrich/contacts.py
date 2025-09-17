from __future__ import annotations

from typing import List

from ..models import Contact


def find_contacts(company: str, domain: str | None) -> List[Contact]:
    """Stub: Find and verify contacts. Integrate with ZeroBounce for email validation."""
    contacts = [
        Contact(name="Alex Smith", email=f"alex@{domain}" if domain else None, title="Operations Manager"),
        Contact(name="Jamie Lee", email=f"jamie@{domain}" if domain else None, title="Finance Director"),
    ]
    return contacts
