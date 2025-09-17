from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Dict

from dateutil import tz

from .config import EngineConfig, SaturationConfig
from .models import Lead, ScoreComponents, ScoreResult


def _compute_decay_factor(last_activity_at: datetime | None, half_life_days: float) -> float:
    if last_activity_at is None:
        return 1.0
    if last_activity_at.tzinfo is None:
        last_activity_at = last_activity_at.replace(tzinfo=tz.UTC)
    now = datetime.now(timezone.utc)
    elapsed_days = (now - last_activity_at).total_seconds() / 86400.0
    if elapsed_days <= 0:
        return 1.0
    # Exponential decay: factor = 0.5^(t/half_life)
    return math.pow(0.5, elapsed_days / max(half_life_days, 1e-6))


def _saturating_contribution(count: int, saturation: SaturationConfig, weight: float) -> float:
    # f(count) = (1 - exp(-k * count)) * weight
    return (1.0 - math.exp(-saturation.k * max(count, 0))) * weight


def score_lead(lead: Lead, config: EngineConfig) -> ScoreResult:
    sc = config.scoring
    weights = sc.weights
    sats: Dict[str, SaturationConfig] = sc.saturations

    metric_components: Dict[str, float] = {}
    metric_components["email_opens"] = _saturating_contribution(
        lead.metrics.email_opens, sats.get("email_opens", SaturationConfig()), weights.email_opens
    )
    metric_components["email_clicks"] = _saturating_contribution(
        lead.metrics.email_clicks, sats.get("email_clicks", SaturationConfig()), weights.email_clicks
    )
    metric_components["site_visits"] = _saturating_contribution(
        lead.metrics.site_visits, sats.get("site_visits", SaturationConfig()), weights.site_visits
    )

    firmographic_component = max(0.0, float(lead.firmographic_score)) * weights.firmographic
    intent_component = max(0.0, float(lead.intent_score)) * weights.intent

    raw_score = sum(metric_components.values()) + firmographic_component + intent_component

    decay_factor = _compute_decay_factor(lead.last_activity_at, sc.half_life_days)
    final_score = raw_score * decay_factor

    components = ScoreComponents(
        metric_components=metric_components,
        firmographic_component=firmographic_component,
        intent_component=intent_component,
        decay_factor=decay_factor,
    )

    return ScoreResult(lead_id=lead.id, score=final_score, components=components)
