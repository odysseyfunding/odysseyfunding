from __future__ import annotations

import argparse
from typing import Any, Dict

from fastapi import FastAPI
from pydantic import BaseModel
import uvicorn

from .config import EngineConfig
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


def main() -> None:
    parser = argparse.ArgumentParser(description="Run Signal-to-Lead API service")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()
    uvicorn.run(app, host=args.host, port=args.port)


if __name__ == "__main__":
    main()
