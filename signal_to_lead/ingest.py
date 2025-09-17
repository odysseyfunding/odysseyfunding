from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from dateutil import parser as dtparser

from .models import Lead, LeadMetrics


def _parse_datetime(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        return dtparser.isoparse(value)
    except Exception:
        return None


def normalize_jotform_payload(payload: Dict[str, Any], mapping: Dict[str, str]) -> Lead:
    def g(key: str) -> Any:
        src = mapping.get(key)
        if not src:
            return None
        return payload.get(src)

    metrics = LeadMetrics(
        email_opens=int(g("metrics.email_opens") or 0),
        email_clicks=int(g("metrics.email_clicks") or 0),
        site_visits=int(g("metrics.site_visits") or 0),
    )

    product_interest_val = g("product_interest")
    if isinstance(product_interest_val, str):
        product_interest: List[str] = [p.strip() for p in product_interest_val.split(",") if p.strip()]
    elif isinstance(product_interest_val, list):
        product_interest = [str(p) for p in product_interest_val]
    else:
        product_interest = []

    lead = Lead(
        id=str(g("id") or g("email") or g("company") or f"lead_{int(datetime.utcnow().timestamp())}"),
        email=g("email"),
        company=g("company"),
        country=g("country"),
        state=g("state"),
        employee_count=int(g("employee_count") or 0) or None,
        revenue=float(g("revenue") or 0.0) or None,
        product_interest=product_interest,
        firmographic_score=float(g("firmographic_score") or 0.0),
        intent_score=float(g("intent_score") or 0.0),
        metrics=metrics,
        last_activity_at=_parse_datetime(g("last_activity_at")),
        created_at=_parse_datetime(g("created_at")),
    )
    return lead
