# Current status

- **Branch health**: This repo is the canonical root. Branch `main` is protected. Main has Phase 1–7 unified (SHA 8d2e909, PR #18). Feature branch `feat/pii-redaction` has Phase 8 (PII redaction guardrails).
- **Architecture snapshot**: Monorepo with apps/web (Next.js), apps/api (Fastify), packages/domain (types, policy, db schema, SQLite stores, audit, PII detector, guardrail store). See docs/architecture.md.
- **Done**: Phases 1–7 on main: proxy, agent registry, policy, cost dashboard, SQLite persistence + audit logs, per-team cost attribution + budget enforcement, RBAC + API key auth. Phase 8 on `feat/pii-redaction`: regex-based PII detection (email, phone, SSN, credit card with Luhn, IP, API keys), redact/warn/block modes, guardrail_configs table, GET/POST/PATCH /api/guardrails, PII check in proxy before upstream.
- **In progress**: Phase 8 PR (feat/pii-redaction → main).
- **Blockers**: None. SQLite tests run only when better-sqlite3 native bindings are available (`pnpm rebuild better-sqlite3` if skipped).
- **Next 3 priorities**: (1) Merge Phase 8 PR. (2) Optional: prompt-injection or content-filter guardrails. (3) Web UI for guardrail config.
