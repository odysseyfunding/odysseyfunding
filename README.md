## Lead Generation Bot — Hiring Signals to Funding Prospects

Identify established businesses with hiring deficits (many open roles, repeat postings, long-open listings) and generate enriched leads for merchant cash advance outreach.

### Structure
- `src/sources/`: Indeed, LinkedIn, Craigslist clients (stubs)
- `src/enrich/`: company profile and contacts enrichment (stubs)
- `src/storage/`: Google Sheets storage
- `src/scoring.py`: deficit detection and lead scoring
- `scripts/cli.py`: CLI entrypoint
- `tests/`: unit tests for scoring and normalization
- `docs/`: spec and datasources

### Requirements
- Python 3.11
- Credentials via environment variables (.env example provided)

### Quickstart
```bash
make setup
make test
source .venv/bin/activate
python scripts/cli.py "operations manager" --location "US" --out /tmp/leads.csv
```

To enable Google Sheets export, set `GOOGLE_SERVICE_ACCOUNT_JSON` to the JSON content, `GOOGLE_SHEETS_SPREADSHEET_ID`, and optional `GOOGLE_SHEETS_WORKSHEET`.

### Environment (.env)
See `.env.example` and export variables prior to running.

### Notes
- External API calls are stubbed; replace with SerpAPI/ZeroBounce/GSuite integrations where indicated.
