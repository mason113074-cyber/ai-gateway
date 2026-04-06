# CURSOR — What to do next (maintained)

> **Historical “phase” runbooks (Phases 1–11, SQLite migration, RBAC, Docker, etc.) are complete on `main`.** They are not a pending backlog. Do not re-execute old step-by-step build instructions unless you are intentionally porting to a new codebase.

## Source of truth
- **Shipped scope and architecture**: `docs/context/current-status.md` and `docs/architecture.md`
- **Agent onboarding**: `AGENTS.md`

## Shipped on `main` (do not track as “next phases”)

| Area | Notes |
|------|--------|
| Core `/v1/*` proxy, policy, budgets, PII guardrails, sliding-window rate limits | Implemented in `apps/api/src/proxy*.ts` and domain |
| REST management API | Per-resource modules under `apps/api/src/routes/*.ts`, aggregated by `registerRestRoutes` in `routes/index.ts` |
| LLM proxy registration | `routes/register-proxy.ts` (`registerProxyPlugin`) — scoped parser + `registerProxyRoutes` |
| Process wiring | `server-bootstrap.ts` creates stores, auth, proxy plugin, REST routes; `server.ts` loads env only |
| Web admin BFF | `/api/gateway/*` + `GATEWAY_INTERNAL_API_URL` / `NEXT_PUBLIC_API_BASE_URL` (see `apps/web/lib/server-auth.ts`) |
| Docker Compose, CI, SQLite WAL | See `docker-compose.yml`, `.github/workflows/ci.yml` |

If a task reads like “implement Phase N” from an old prompt, assume **done** unless you have a concrete regression or new requirement.

## Product priorities (future work — research-backed, not a phased runbook)

| Priority | Theme | Notes |
|----------|--------|-------|
| P0 | Adapter layer for multi-provider | Prerequisite before any cross-provider fallback |
| P0 | PostgreSQL runtime parity | Optional enterprise path; SQLite remains default OSS |
| P1 | SSO / SAML | Common enterprise gate |
| P1 | Web E2E tests | Admin flows currently manual |
| P2 | Helm / K8s packaging | After compose is stable |

## Intentionally deferred (not missing phases)

These are **not** forgotten “Phase N” items; they are follow-ups when there is a concrete driver:

| Item | Why deferred |
|------|----------------|
| Further splitting `server-bootstrap.ts` (e.g. dedicated `createGatewayContainer()` for every store) | Current file is bounded; extra abstraction only pays off once we need multiple entrypoints or heavy integration tests against wiring |
| Fastify encapsulation as formal `@fastify/*` child plugins per domain | REST is already modular; formal plugins add boilerplate until we mount routes in more than one process or share plugins across services |
| OpenAPI / schema-first route registration | No consumer yet; add when we publish a stable external API contract |

## Historical context

The detailed Phase 5–10 prompts remain in git history for reference only. If you need the old narrative, use `git log --follow -- docs/CURSOR_NEXT_ORDER.md`.

## Competitive snapshot (illustrative)

Enterprise buyers often require SOC 2 and SSO; gateway + compliance + guardrails remains a crowded but differentiated space when agent identity (`x-agent-id`) and policy are first-class.
