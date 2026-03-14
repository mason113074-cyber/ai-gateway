# Current status

- **Branch health**: Only `main` branch exists. Protected. All feature branches merged and deleted.
- **Architecture snapshot**: Monorepo with apps/web (Next.js), apps/api (Fastify), packages/domain (types, policy, db schema, SQLite stores, audit, PII detector, guardrail store, rate limiter, rate limit config store). See docs/architecture.md.
- **Done**: Phases 1–10 on main. Docker Compose + OSS launch readiness complete.
  - Phase 1–4: Core proxy, policy engine, agent registry, admin dashboard
  - Phase 5: Persistent storage (SQLite WAL), immutable audit logs
  - Phase 6: Cost attribution, per-team/per-agent budget enforcement
  - Phase 7: RBAC, API key auth (SHA-256 hashed), role-based permissions
  - Phase 8: PII detection & redaction guardrails (regex-based, zero deps)
  - Phase 9: Per-team/per-agent sliding-window rate limiting
  - Phase 10: Dockerfiles, docker-compose.yml, README, CONTRIBUTING, LICENSE, CI
- **Database**: 10 tables (proxy_logs, agents, audit_logs, team_budgets, agent_budgets, users, api_keys, guardrail_configs, rate_limit_windows, rate_limit_configs)
- **API routes**: 22+ endpoints (proxy /v1/*, agents, logs, audit, budgets, costs, keys, guardrails, rate-limits, stats, health, session, policy)
- **In progress**: None. Ready for v0.1.0 release.
- **Blockers**: None. SQLite tests run only when better-sqlite3 native bindings are available.
- **Next 3 priorities**: (1) Create GitHub Release v0.1.0. (2) GTM launch (HN, Reddit, LinkedIn). (3) Web UI for rate limit config.
