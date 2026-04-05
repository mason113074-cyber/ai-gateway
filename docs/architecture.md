# Architecture

## High-level view

```text
AI Agents (any LLM caller)
      ↓  change base URL to gateway
Fastify LLM Proxy (/v1/*)
      ↓  x-agent-id / x-team-id headers
Policy Engine → allow / deny / requires_approval
      ↓
Upstream LLM (OpenAI, Anthropic, etc.)
      ↓
Audit Log + Cost Tracking + PII Detection
```

## Layers

### Web (apps/web)
Next.js 14+ Admin Console:
- Dashboard: cost overview, request stats
- Agent registry: list, edit, status
- Logs: request log viewer
- Approvals: pending approval queue
- Audit: compliance event viewer

### API (apps/api)
Fastify 5 with:
- /v1/* — LLM proxy with streaming SSE passthrough
- /api/agents — Agent registry CRUD
- /api/logs — Request log query
- /api/stats — Cost and usage stats
- Auth middleware:
  - Gateway API key auth (`Authorization: Bearer gw-...` or `x-api-key`)
  - Bootstrap admin bearer token (`BOOTSTRAP_ADMIN_TOKEN`) for self-hosted admin access
  - Legacy header auth (`x-workspace-id`/`x-user-id`) disabled by default and only available when `ALLOW_LEGACY_HEADER_AUTH=true` and `NODE_ENV !== "production"`
- `/health` — liveness (no auth)
- `/metrics` — Prometheus text format: `gateway_proxy_requests_total` (proxy path) and `gateway_process_heap_bytes`; optional OpenTelemetry (`@fastify/otel`) can be layered on later

### Domain (packages/domain)
Shared logic and types:
- Policy engine (evaluatePolicy → allow/deny/requires_approval)
- Agent registry (auto-register on first request)
- Log store (InMemoryLogStore, will migrate to SQLite)
- Workspace and RBAC types
- Proxy types and cost estimation

## Database (Phase 5+)
- SQLite via better-sqlite3 + drizzle-orm
- WAL mode for concurrent reads
- BEGIN IMMEDIATE for atomic budget enforcement
- Tables: agents, proxy_logs, budgets, policy_rules, audit_events
- Runtime currently fails closed when `DATABASE_URL` is set; production runtime supports SQLite only.

## Key decisions
- SQLite over PostgreSQL: simpler deployment for solo founder, sufficient for <10K agents
- Agent identity via x-agent-id header: differentiator vs competitors (request-level only)
- MIT proxy + closed-source governance: validated by Helicone/Langfuse/LiteLLM patterns
- Streaming SSE passthrough: no buffering, preserves OpenAI/Anthropic response format
- Cross-provider fallback is disabled by default because OpenAI and Anthropic payload/response formats are not interchangeable without explicit adapters.

## Completed phases (on main)
- Phase 1: LLM Proxy Layer
- Phase 2: Agent Registry + Auto-register
- Phase 3: Policy Engine (allow/deny/requires_approval)
- Phase 4: Dashboard + README

## Next phases (see docs/CURSOR_NEXT_ORDER.md)
- Phase 5: Persistent Storage + Audit Logs (SQLite)
- Phase 6: Budget Enforcement
- Phase 7: PII Detection
- Phase 8: RBAC + API Keys
- Phase 9: Multi-Provider Router
- Phase 10: Compliance Export
