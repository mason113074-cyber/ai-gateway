# Current status

- **Branch health**: This repo is the canonical root. Branch `main` is protected. Main has Phase 1–8 (PII guardrails merged). Feature branch `feat/rate-limiting` has Phase 9 (per-team/per-agent rate limiting).
- **Architecture snapshot**: Monorepo with apps/web (Next.js), apps/api (Fastify), packages/domain (types, policy, db schema, SQLite stores, audit, PII detector, guardrail store, rate limiter, rate limit config store). See docs/architecture.md.
- **Done**: Phases 1–8 on main. Phase 9 on `feat/rate-limiting`: sliding-window rate limiter (SQLite-backed, 2-minute window), global/team/agent configs, GET/POST/DELETE /api/rate-limits, GET /api/rate-limits/status, rate limit check in proxy (after budget, before PII), consume on success (JSON + SSE), periodic cleanup.
- **In progress**: Phase 9 PR (feat/rate-limiting → main).
- **Blockers**: None. SQLite tests run only when better-sqlite3 native bindings are available (`pnpm rebuild better-sqlite3` if skipped).
- **Next 3 priorities**: (1) Merge Phase 9 PR. (2) Web UI for rate limit config. (3) Optional: prompt-injection or content-filter guardrails.
