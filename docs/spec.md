### Signal-to-Lead Engine — Product & Technical Spec

#### Goal
Score leads from behavioral and firmographic signals and route them to the right owners using configurable rules and round-robin.

#### Scope (v1)
- Input: JSON over API; JSONL/CSV via CLI
- Scoring: Saturating metrics + firmographic + intent with time-decay
- Routing: Queue filters (geo, employee_count, product_interest) + round-robin owners
- Config: YAML
- Output: score, components, queue, owner, rule_match

#### API
- POST `/score-route`
  - Body: `Lead` JSON
  - Query or body: `config_path` (default `configs/default.yaml`)
  - Returns: `ScoreRouteResponse`

#### Data Model (Lead)
- id, email, company, country, state
- employee_count, revenue, product_interest[]
- firmographic_score, intent_score
- metrics: email_opens, email_clicks, site_visits
- last_activity_at, created_at

#### Scoring
- Saturation: `1 - exp(-k * count)` per metric
- Weights: per metric + firmographic + intent
- Time-decay: `0.5^(days_since / half_life_days)`

#### Routing
- Filter fields: country_in, state_in
- employee_count: lt, lte, gte, gt
- product_interest_in
- Default queue fallback
- Round-robin persisted to `routing.state_file`

#### Non-Goals (v1)
- ML training, CRM sync, rate limits, auth

#### Next
- Add persisters, audit logs, SLA metrics, queues by score threshold
