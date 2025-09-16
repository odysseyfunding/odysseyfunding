PROJECT CONTEXT AND COLLABORATION GUIDE

Purpose
- Use this repository as persistent shared memory for our collaboration.
- Keep key decisions, context, and conventions here so work continues smoothly even if a chat resets.

Core Files
- .cursor/rules — Persistent instructions for this workspace.
- docs/chat-history-YYYY-MM-DD.md — Daily decision log, one file per date.
- scripts/log_decision.sh — Helper to append structured entries to today’s log.

Decision Log Conventions
- Each entry should include:
  - UTC timestamp
  - Short, action-oriented title
  - Context and rationale (brief but clear)
  - Outcome and any follow-ups/owners
  - Optional tags for quick filtering (e.g., infra, backend, product)

Quick Logging via Script
- Example:
  - /workspace/scripts/log_decision.sh -t "Add Redis cache" -b "Reason: reduce DB load for hot keys. Outcome: enable read-through. Follow-up: set eviction policy." -g "infra,cache"
- Safe to run multiple times per day; it appends to the file for today’s date.

Manual Logging (fallback)
- Append to docs/chat-history-YYYY-MM-DD.md using the same structure. Avoid including secrets.

Operating Norms
- Use this same chat thread when possible; keep your account signed in.
- Prefer documenting decisions and rationale over long backscroll searches.
- When adding significant features or config changes, log a decision entry.

Privacy and Security
- Do not paste credentials, tokens, or customer PII into logs.
- Summarize sensitive details and store secrets in your standard secret manager.

