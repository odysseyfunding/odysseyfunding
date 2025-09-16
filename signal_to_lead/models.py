from __future__ import annotations

from datetime import datetime
from typing import Dict, List, Optional

from pydantic import BaseModel, Field


class LeadMetrics(BaseModel):
    email_opens: int = 0
    email_clicks: int = 0
    site_visits: int = 0


class Lead(BaseModel):
    id: str
    email: Optional[str] = None
    company: Optional[str] = None
    country: Optional[str] = None
    state: Optional[str] = None
    employee_count: Optional[int] = None
    revenue: Optional[float] = None
    product_interest: List[str] = Field(default_factory=list)
    firmographic_score: float = 0.0
    intent_score: float = 0.0
    metrics: LeadMetrics = Field(default_factory=LeadMetrics)
    last_activity_at: Optional[datetime] = None
    created_at: Optional[datetime] = None


class ScoreComponents(BaseModel):
    metric_components: Dict[str, float]
    firmographic_component: float
    intent_component: float
    decay_factor: float


class ScoreResult(BaseModel):
    lead_id: str
    score: float
    components: ScoreComponents


class RouteDecision(BaseModel):
    lead_id: str
    queue: str
    owner: str
    rule_match: Optional[str] = None
