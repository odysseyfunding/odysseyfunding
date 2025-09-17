from __future__ import annotations

import argparse
from typing import Any, Dict

from fastapi import FastAPI, Request
from pydantic import BaseModel
import uvicorn

from .config import EngineConfig
from .excel import append_row
from .ingest import normalize_jotform_payload
from .models import Lead
from .routing import route_lead
from .scoring import score_lead


class ScoreRouteResponse(BaseModel):
    score: float
    components: Dict[str, Any]
    queue: str
    owner: str
    rule_match: str | None


app = FastAPI(title="Signal-to-Lead Engine")


def load_config(path: str) -> EngineConfig:
    return EngineConfig.from_yaml(path)


@app.post("/score-route")
def score_and_route(lead: Lead, config_path: str = "configs/default.yaml") -> ScoreRouteResponse:
    cfg = load_config(config_path)
    score_result = score_lead(lead, cfg)
    route = route_lead(lead, cfg)
    return ScoreRouteResponse(
        score=score_result.score,
        components=score_result.components.model_dump(),
        queue=route.queue,
        owner=route.owner,
        rule_match=route.rule_match,
    )


@app.post("/webhooks/jotform")
async def jotform_webhook(
    request: Request,
    config_path: str = "configs/default.yaml",
    mapping_path: str = "configs/jotform_mapping.yaml",
    excel_path: str = "/workspace/leads.xlsx",
):
    raw = await request.json()
    import yaml

    with open(mapping_path, "r", encoding="utf-8") as f:
        mapping = yaml.safe_load(f) or {}

    cfg = load_config(config_path)
    lead = normalize_jotform_payload(raw, mapping)
    score_result = score_lead(lead, cfg)
    route = route_lead(lead, cfg)

    append_row(
        excel_path,
        {
            "lead_id": lead.id,
            "email": lead.email,
            "company": lead.company,
            "country": lead.country,
            "state": lead.state,
            "employee_count": lead.employee_count,
            "revenue": lead.revenue,
            "product_interest": lead.product_interest,
            "firmographic_score": lead.firmographic_score,
            "intent_score": lead.intent_score,
            "email_opens": lead.metrics.email_opens,
            "email_clicks": lead.metrics.email_clicks,
            "site_visits": lead.metrics.site_visits,
            "last_activity_at": lead.last_activity_at.isoformat() if lead.last_activity_at else None,
            "score": score_result.score,
            "queue": route.queue,
            "owner": route.owner,
            "rule_match": route.rule_match,
        },
    )

    return {
        "status": "ok",
        "lead_id": lead.id,
        "score": score_result.score,
        "queue": route.queue,
        "owner": route.owner,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Run Signal-to-Lead API service")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()
    uvicorn.run(app, host=args.host, port=args.port)


if __name__ == "__main__":
    main()
