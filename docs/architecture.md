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
Next.js 16 (App Router) admin console:
- Dashboard: cost overview, request stats
- Agent registry: list, edit, status
- Logs: request log viewer
- Approvals: pending approval queue (mock data)
- Audit: compliance event viewer (immutable `audit_logs` + mock legacy endpoints)

### API (apps/api)
Fastify 5 with:
- /v1/* — LLM proxy with streaming SSE passthrough (handler in `apps/api/src/proxy.ts`, helpers in `proxy-*.ts`; Fastify registration in `apps/api/src/routes/register-proxy.ts` via `registerProxyPlugin`)
- /api/* — REST surface registered from `apps/api/src/routes/*` via `registerRestRoutes` in `apps/api/src/routes/index.ts` (process wiring in `apps/api/src/server-bootstrap.ts`; entrypoint `server.ts` only loads env and calls `startGatewayServer()`)
- Auth middleware:
  - Gateway API key auth (`Authorization: Bearer gw-...` or `x-api-key`)
  - Bootstrap admin bearer token (`BOOTSTRAP_ADMIN_TOKEN`) for self-hosted admin access
  - Legacy header auth (`x-workspace-id`/`x-user-id`) disabled by default and only available when `ALLOW_LEGACY_HEADER_AUTH=true` and `NODE_ENV !== "production"`
- `/health` — liveness (no auth)
- `/metrics` — Prometheus text format: `gateway_proxy_requests_total` (proxy path) and `gateway_process_heap_bytes`; optional OpenTelemetry (`@fastify/otel`) can be layered on later

### Web → API bridge (admin console)
- Browser calls same-origin `/api/gateway/*` (Next Route Handler).
- Server-side fetches use `GATEWAY_INTERNAL_API_URL` when set (Docker Compose / K8s), else `NEXT_PUBLIC_API_BASE_URL`, else `http://localhost:4000`. This avoids relying on `NEXT_PUBLIC_*` alone, which is inlined at web build time for client bundles.

### Domain (packages/domain)
Shared logic and types:
- Policy engine (evaluatePolicy → allow/deny/requires_approval)
- Agent registry (auto-register on first request)
- SQLite-backed log store, audit logger, budgets, API keys, guardrails, rate limits
- Workspace and RBAC types
- Proxy types and cost estimation

## Database
- SQLite via better-sqlite3 + drizzle-orm
- WAL mode for concurrent reads
- BEGIN IMMEDIATE for atomic budget enforcement
- Tables include: agents, proxy_logs, team_budgets, agent_budgets, audit_logs, api_keys, guardrail_configs, rate_limit_windows, rate_limit_configs, users
- Runtime fails closed when `DATABASE_URL` is set; production runtime supports SQLite only.

## Key decisions
- SQLite over PostgreSQL in this release: simpler deployment; PostgreSQL support is a future milestone (see `docs/context/current-status.md`).
- Agent identity via x-agent-id header: differentiator vs competitors (request-level only)
- MIT proxy + closed-source governance: validated by Helicone/Langfuse/LiteLLM patterns
- Streaming SSE passthrough: no buffering, preserves OpenAI/Anthropic response format
- Cross-provider fallback is disabled by default because OpenAI and Anthropic payload/response formats are not interchangeable without explicit adapters.

## Completed work (on main)
Phases 1–11 are merged: core proxy, persistent storage, budgets, RBAC/API keys, PII guardrails, rate limiting, Docker/CI, and follow-up hardening. Authoritative detail: `docs/context/current-status.md`.

## What to read next
- **Current truth**: `docs/context/current-status.md`
- **Roadmap / backlog**: `docs/CURSOR_NEXT_ORDER.md` (high-level priorities, not a phase-by-phase implementation runbook)
