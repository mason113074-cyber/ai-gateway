# Backlog — AI Gateway

> Phases 1-4 completed and on main. See docs/CURSOR_MASTER_ORDER.md for history.
> Phases 5-10 are the current roadmap. See docs/CURSOR_NEXT_ORDER.md for detailed step-by-step instructions.

## Phase 5: Persistent Storage + Audit Logs (NEXT)
- Install better-sqlite3 + drizzle-orm
- Create schema: agents, proxy_logs, budgets, policy_rules, audit_events
- Migrate InMemoryLogStore → SQLite
- Migrate InMemoryAgentRegistry → SQLite
- Immutable audit_events table with timestamp indexing
- GET /api/audit endpoint

## Phase 6: Budget Enforcement
- Budget table (agent/team level, daily/monthly)
- Atomic check-then-spend with BEGIN IMMEDIATE
- 403 response when budget exhausted
- Budget dashboard cards

## Phase 7: PII Detection
- Regex-based PII detector (SSN, credit card, email, phone)
- Three modes: redact / warn / block
- Per-agent PII policy configuration
- Audit log for PII events

## Phase 8: RBAC + API Keys
- API key management (create, rotate, revoke)
- Role-based access control (admin, viewer, agent-owner)
- SSO-ready authentication flow
- Key scoping (per-workspace, per-agent)

## Phase 9: Multi-Provider Router
- Anthropic Messages API support
- Azure OpenAI support
- Smart routing (cost, latency, availability)
- Provider health checks

## Phase 10: Compliance Export
- SOC 2 audit report export
- HIPAA access log export
- EU AI Act high-risk system documentation
- CSV/JSON export for auditors
