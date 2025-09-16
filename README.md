## Signal-to-Lead Engine (Scoring and Routing)

A lightweight, configurable engine to score incoming leads from behavioral and firmographic signals, then route them to the appropriate owner/team using rule-based filtering and round-robin.

### Features
- Configurable scoring weights with time-decay
- Rule-based routing with queue-level round-robin
- FastAPI service for real-time scoring/routing
- CLI for batch processing JSONL/CSV

### Quickstart

1) Install dependencies
```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

2) Try the CLI on sample data
```bash
python -m signal_to_lead.cli score-route \
  --config configs/default.yaml \
  --in data/sample_leads.jsonl \
  --out /tmp/scored_routed.jsonl
```

3) Run the API
```bash
python -m signal_to_lead.service --host 0.0.0.0 --port 8000
# Then POST to http://localhost:8000/score-route
```

### Configuration
See `configs/default.yaml` for a documented example. You can tune scoring weights, half-life for decay, and routing queues/filters/owners.

### File Layout
- `signal_to_lead/`: package with engine modules
- `configs/`: YAML configuration files
- `data/`: sample input datasets

### Input Format
The engine expects lead objects in JSON with fields such as:
```json
{
  "id": "lead_123",
  "country": "US",
  "state": "CA",
  "employee_count": 120,
  "firmographic_score": 0.7,
  "intent_score": 0.6,
  "metrics": {"email_opens": 3, "email_clicks": 1, "site_visits": 5},
  "last_activity_at": "2025-08-26T12:00:00Z",
  "product_interest": ["core"]
}
```

### License
MIT
