from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path
from typing import Dict, Iterable, Iterator, List

from pydantic import ValidationError

from .config import EngineConfig
from .models import Lead
from .routing import route_lead
from .scoring import score_lead


def _iter_jsonl(path: Path) -> Iterator[Dict]:
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            yield json.loads(line)


def _iter_csv(path: Path) -> Iterator[Dict]:
    with path.open("r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            yield row


def _detect_input_iter(path: Path) -> Iterator[Dict]:
    suffix = path.suffix.lower()
    if suffix == ".jsonl" or suffix == ".ndjson":
        return _iter_jsonl(path)
    if suffix == ".csv":
        return _iter_csv(path)
    raise ValueError(f"Unsupported input format: {suffix}")


def _write_jsonl(path: Path, rows: Iterable[Dict]) -> None:
    with path.open("w", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row) + "\n")


def cmd_score_route(args: argparse.Namespace) -> None:
    cfg = EngineConfig.from_yaml(args.config)
    in_path = Path(args.in_path)
    out_path = Path(args.out)
    rows: List[Dict] = []
    for obj in _detect_input_iter(in_path):
        try:
            lead = Lead.model_validate(obj)
        except ValidationError as e:
            if args.skip_invalid:
                continue
            raise e
        score = score_lead(lead, cfg)
        route = route_lead(lead, cfg)
        rows.append(
            {
                "lead_id": lead.id,
                "score": score.score,
                "components": score.components.model_dump(),
                "queue": route.queue,
                "owner": route.owner,
                "rule_match": route.rule_match,
            }
        )
    _write_jsonl(out_path, rows)


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="signal-to-lead")
    sub = p.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("score-route", help="Score and route leads from a file")
    s.add_argument("--config", required=True, help="Path to engine YAML config")
    s.add_argument("--in", dest="in_path", required=True, help="Input file (.jsonl/.csv)")
    s.add_argument("--out", required=True, help="Output file (.jsonl)")
    s.add_argument("--skip-invalid", action="store_true")
    s.set_defaults(func=cmd_score_route)

    return p


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
