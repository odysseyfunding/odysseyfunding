from __future__ import annotations

import argparse
import json
from pathlib import Path

from src.runner import export_to_sheets, run_pipeline


def main() -> None:
    parser = argparse.ArgumentParser(description="Lead Generation Bot CLI")
    parser.add_argument("query", help="Job search query, e.g., 'operations manager'")
    parser.add_argument("--location", help="Optional location filter")
    parser.add_argument("--out", help="Optional output CSV/JSON path")
    args = parser.parse_args()

    leads = run_pipeline(args.query, args.location)

    if args.out:
        path = Path(args.out)
        if path.suffix.lower() == ".json":
            path.write_text(json.dumps([l.__dict__ for l in leads], default=str, indent=2), encoding="utf-8")
        else:
            # Minimal CSV export
            import csv

            with path.open("w", newline="", encoding="utf-8") as f:
                writer = csv.writer(f)
                writer.writerow([
                    "company",
                    "domain",
                    "source",
                    "role_title",
                    "location",
                    "post_age_days",
                    "num_open_roles",
                    "repeat_flag",
                    "establishment_flag",
                    "contacts",
                    "score",
                ])
                for l in leads:
                    writer.writerow([
                        l.company,
                        l.domain,
                        l.source,
                        l.role_title,
                        l.location,
                        l.post_age_days,
                        l.num_open_roles,
                        l.repeat_flag,
                        l.establishment_flag,
                        ", ".join(filter(None, [c.email or "" for c in l.contacts])),
                        l.score,
                    ])

    export_to_sheets(leads)


if __name__ == "__main__":
    main()
