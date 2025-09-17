Principles for the Lead Generation Bot

- Keep integrations behind clear interfaces in `sources/`, `enrich/`, `storage/`.
- All credentials must come from environment variables. Never hardcode secrets.
- Prefer small, composable functions with clear docstrings and typing.
- Make normalization deterministic and testable across sources.
- Do not call external APIs in unit tests; use stubs/mocks and fixtures.
