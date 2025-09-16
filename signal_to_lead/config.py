from __future__ import annotations

from typing import Dict, List, Optional

import yaml
from pydantic import BaseModel, Field, ValidationError


class SaturationConfig(BaseModel):
    # Score contribution uses: 1 - exp(-k * count)
    k: float = 0.5


class ScoringWeights(BaseModel):
    email_opens: float = 0.5
    email_clicks: float = 1.0
    site_visits: float = 0.3
    firmographic: float = 2.0
    intent: float = 2.5


class ScoringConfig(BaseModel):
    half_life_days: float = 14.0
    saturations: Dict[str, SaturationConfig] = Field(
        default_factory=lambda: {
            "email_opens": SaturationConfig(k=0.35),
            "email_clicks": SaturationConfig(k=0.6),
            "site_visits": SaturationConfig(k=0.25),
        }
    )
    weights: ScoringWeights = Field(default_factory=ScoringWeights)


class QueueFilter(BaseModel):
    country_in: Optional[List[str]] = None
    state_in: Optional[List[str]] = None
    employee_count_lt: Optional[int] = None
    employee_count_lte: Optional[int] = None
    employee_count_gte: Optional[int] = None
    employee_count_gt: Optional[int] = None
    product_interest_in: Optional[List[str]] = None


class QueueConfig(BaseModel):
    owners: List[str]
    filters: QueueFilter = Field(default_factory=QueueFilter)


class RoutingConfig(BaseModel):
    queues: Dict[str, QueueConfig]
    default_queue: str
    state_file: Optional[str] = None


class EngineConfig(BaseModel):
    scoring: ScoringConfig = Field(default_factory=ScoringConfig)
    routing: RoutingConfig

    @staticmethod
    def from_yaml(path: str) -> "EngineConfig":
        with open(path, "r", encoding="utf-8") as f:
            raw = yaml.safe_load(f)
        try:
            return EngineConfig(**raw)
        except ValidationError as e:
            raise ValueError(f"Invalid configuration file {path}: {e}")
