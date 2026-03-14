# Current status

- **Branch health**: This repo is the canonical root. Branch `main` is protected. Feature branch `feat/persistent-storage` has Phase 5 implementation (SQLite storage + audit logs).
- **Architecture snapshot**: Monorepo with apps/web (Next.js), apps/api (Fastify), packages/domain (types, policy, db schema, SQLite stores, audit). See docs/architecture.md.
- **Done**: Phases 1–4 (proxy, agent registry, policy, cost dashboard) on main. Phase 5 on `feat/persistent-storage`: persistent SQLite (better-sqlite3 + drizzle-orm), WAL mode, proxy_logs/agents/audit_logs tables; SqliteLogStore, SqliteAgentRegistry, SqliteAuditLogger; immutable audit log; GET /api/audit-logs; Audit logs viewer page in web; data survives restarts.
- **In progress**: Phase 5 PR (feat/persistent-storage → main).
- **Blockers**: None. SQLite tests run only when better-sqlite3 native bindings are available (`pnpm rebuild better-sqlite3` if skipped).
- **Next 3 priorities**: (1) Merge Phase 5 PR. (2) Phase 6 per-team cost attribution + budget enforcement. (3) Phase 7 approval workflow.
