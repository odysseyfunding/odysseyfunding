from __future__ import annotations

import json
import os
from typing import Dict, List, Optional

from .config import EngineConfig, QueueConfig
from .models import Lead, RouteDecision


def _lead_matches_filters(lead: Lead, queue: QueueConfig) -> bool:
    f = queue.filters
    if f.country_in is not None and (lead.country is None or lead.country not in f.country_in):
        return False
    if f.state_in is not None and (lead.state is None or lead.state not in f.state_in):
        return False
    if f.employee_count_lt is not None and not (
        lead.employee_count is not None and lead.employee_count < f.employee_count_lt
    ):
        return False
    if f.employee_count_lte is not None and not (
        lead.employee_count is not None and lead.employee_count <= f.employee_count_lte
    ):
        return False
    if f.employee_count_gte is not None and not (
        lead.employee_count is not None and lead.employee_count >= f.employee_count_gte
    ):
        return False
    if f.employee_count_gt is not None and not (
        lead.employee_count is not None and lead.employee_count > f.employee_count_gt
    ):
        return False
    if f.product_interest_in is not None:
        if not lead.product_interest:
            return False
        if not any(p in f.product_interest_in for p in lead.product_interest):
            return False
    return True


class RoundRobinState:
    def __init__(self, state_file: Optional[str]) -> None:
        self.state_file = state_file
        self.queue_index: Dict[str, int] = {}
        self._load()

    def _load(self) -> None:
        if not self.state_file:
            return
        if os.path.exists(self.state_file):
            try:
                with open(self.state_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                if isinstance(data, dict) and "queue_index" in data:
                    self.queue_index = {k: int(v) for k, v in data.get("queue_index", {}).items()}
            except Exception:
                # Start clean if state is corrupted
                self.queue_index = {}

    def _save(self) -> None:
        if not self.state_file:
            return
        try:
            os.makedirs(os.path.dirname(self.state_file), exist_ok=True)
            with open(self.state_file, "w", encoding="utf-8") as f:
                json.dump({"queue_index": self.queue_index}, f)
        except Exception:
            # Best effort; routing still proceeds
            pass

    def next_owner(self, queue_name: str, owners: List[str]) -> str:
        if not owners:
            raise ValueError(f"Queue {queue_name} has no owners configured")
        idx = self.queue_index.get(queue_name, 0)
        owner = owners[idx % len(owners)]
        self.queue_index[queue_name] = (idx + 1) % len(owners)
        self._save()
        return owner


def route_lead(lead: Lead, config: EngineConfig) -> RouteDecision:
    routing = config.routing
    rr = RoundRobinState(routing.state_file)

    for queue_name, queue_cfg in routing.queues.items():
        if _lead_matches_filters(lead, queue_cfg):
            owner = rr.next_owner(queue_name, queue_cfg.owners)
            return RouteDecision(lead_id=lead.id, queue=queue_name, owner=owner, rule_match=queue_name)

    # Default queue fallback
    default_cfg = routing.queues.get(routing.default_queue)
    if default_cfg is None:
        raise ValueError(f"Default queue {routing.default_queue} not found in configuration")
    owner = rr.next_owner(routing.default_queue, default_cfg.owners)
    return RouteDecision(lead_id=lead.id, queue=routing.default_queue, owner=owner, rule_match=None)
