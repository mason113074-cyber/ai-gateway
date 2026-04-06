# AI Gateway

Open-source LLM proxy with agent identity, cost tracking, governance, and guardrails.

## Who is this for?

- **Engineering teams** routing OpenAI/Anthropic traffic through a single control plane
- **Compliance-conscious orgs** that need immutable audit logs and PII redaction
- **Product teams** that want per-agent and per-team cost attribution and rate limits

## Docker Quick Start

```bash
git clone https://github.com/mason113074-cyber/ai-gateway.git
cd ai-gateway
cp .env.example .env
# Edit .env: set OPENAI_API_KEY, ANTHROPIC_API_KEY, and BOOTSTRAP_ADMIN_TOKEN
# The same BOOTSTRAP_ADMIN_TOKEN must be available to both api and web (Compose passes it through).
docker compose up -d
```

`docker-compose.yml` sets `GATEWAY_INTERNAL_API_URL=http://api:4000` (and `NEXT_PUBLIC_API_BASE_URL` for compatibility) on the **web** container so server-side `/api/gateway/*` fetches reach the API by Docker DNS name (not `localhost`). `getGatewayApiBaseUrl()` prefers `GATEWAY_INTERNAL_API_URL`, then `NEXT_PUBLIC_API_BASE_URL` (see `apps/web/lib/server-auth.ts`).

- **API:** http://localhost:4000  
- **Web console:** http://localhost:3000  

Point your LLM client at `http://localhost:4000/v1` and add headers:

- `x-agent-id`: agent identifier (e.g. `my-support-bot`)
- `x-team-id`: team identifier (e.g. `cx-team`)
- `x-provider`: `openai` or `anthropic`

## Code change example (Python)

**Before (direct to OpenAI):**

```python
from openai import OpenAI
client = OpenAI(api_key="sk-...", base_url="https://api.openai.com/v1")
response = client.chat.completions.create(model="gpt-4", messages=[...])
```

**After (via AI Gateway):**

```python
from openai import OpenAI
client = OpenAI(
    api_key="sk-...",  # or use gateway API key
    base_url="http://localhost:4000/v1"
)
# Add headers via default headers or per-request
response = client.chat.completions.create(
    model="gpt-4",
    messages=[...],
    extra_headers={"x-agent-id": "my-bot", "x-team-id": "platform"}
)
```

Every request is now logged, cost-tracked, and evaluated against policies and rate limits.

## Authentication and security defaults

- **Production default**: unauthenticated management access is denied.
- **Admin management access**: use `Authorization: Bearer <BOOTSTRAP_ADMIN_TOKEN>` or a gateway API key with required permissions.
- **Legacy header auth (`x-workspace-id` / `x-user-id`)** is **disabled by default** and only available when:
  - `ALLOW_LEGACY_HEADER_AUTH=true`
  - `NODE_ENV` is not `production`
- Web console server-side API calls are proxied through `/api/gateway/*` and require `BOOTSTRAP_ADMIN_TOKEN` in web runtime.

## Features

| Feature | Description |
|--------|-------------|
| **LLM proxy** | `/v1/*` wildcard, SSE streaming, OpenAI + Anthropic |
| **Agent registry** | Auto-register agents, CRUD API |
| **Policy engine** | Allow / deny / requires_approval |
| **Cost dashboard** | Per-agent, per-team, per-model cost and tokens |
| **Persistent storage** | SQLite (WAL), proxy logs, agents, audit logs |
| **Retry behavior** | Same-provider retries on transient upstream errors |
| **Budgets** | Per-team monthly and per-agent daily caps (hard/soft) |
| **RBAC + API keys** | SHA-256 hashed keys, permissions, model allowlists |
| **PII guardrails** | Regex-based redact/warn/block (email, SSN, cards, etc.) |
| **Rate limiting** | Per-team and per-agent sliding-window limits |

## Architecture

```
                    ┌─────────────────────────────────────────┐
                    │              AI Gateway                   │
  LLM clients ────► │  API (Fastify :4000)                     │
  x-agent-id        │    ├─ /v1/*        → upstream (OpenAI/   │
  x-team-id         │    │   policy → budget → PII → rate limit│
                    │    ├─ /api/agents, /api/logs, /api/audit  │
                    │    ├─ /api/budgets, /api/rate-limits      │
                    │    └─ /api/guardrails, /api/keys          │
                    │  Web (Next.js :3000) — admin console      │
                    │  SQLite (gateway.db) — 10 tables          │
                    └─────────────────────────────────────────┘
                                        │
                                        ▼
                    OpenAI API / Anthropic API
```

## API Reference

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Liveness |
| GET | `/api/session` | Current workspace / user / permissions |
| GET | `/api/agents` | List agents (`read:agents`) |
| POST | `/api/agents` | Create agent |
| PATCH | `/api/agents/:id` | Update agent |
| GET | `/api/audit-logs` | Query audit log (filters, pagination) |
| GET | `/api/guardrails` | List guardrail configs |
| POST | `/api/guardrails` | Create/update guardrail |
| PATCH | `/api/guardrails/:id` | Enable/disable guardrail |
| GET | `/api/rate-limits` | List rate limit configs (`read:rate-limits`) |
| POST | `/api/rate-limits` | Create/update rate limit (`write:rate-limits`) |
| DELETE | `/api/rate-limits/:id` | Remove rate limit (`write:rate-limits`) |
| GET | `/api/rate-limits/status` | Current usage per config (`read:rate-limits`) |
| GET | `/api/logs` | Proxy request logs |
| GET | `/api/stats` | Aggregated stats (cost, tokens) |
| GET | `/api/budgets/teams` | List team budgets |
| POST | `/api/budgets/teams` | Set team budget |
| GET | `/api/budgets/teams/:teamId` | Get team budget |
| POST | `/api/budgets/agents` | Set agent budget |
| GET | `/api/budgets/agents/:agentId` | Get agent budget |
| GET | `/api/costs` | Cost attribution (groupBy) |
| POST | `/api/policy/evaluate` | Evaluate policy for an action |
| POST | `/api/keys` | Create API key |
| GET | `/api/keys` | List API keys (`read:keys`) |
| PATCH | `/api/keys/:id` | Update key |
| DELETE | `/api/keys/:id` | Revoke key |

Authenticate with either:

- `Authorization: Bearer gw-<key>` (gateway API key)
- `Authorization: Bearer <BOOTSTRAP_ADMIN_TOKEN>` (bootstrap admin token from environment)

## Current limitations (explicit)

- `DATABASE_URL` (PostgreSQL) is currently **fail-closed** at startup in this release.
- Cross-provider fallback adapters are not implemented; proxy will not auto-switch OpenAI ↔ Anthropic by default.

## Development

```bash
pnpm install
pnpm turbo dev
```

- API: http://localhost:4000  
- Web: http://localhost:3000  

Run checks and tests:

```bash
pnpm turbo check
pnpm turbo test
pnpm turbo build
```

## Project memory

- **AGENTS.md** — mission, boundaries, workflow, definition of done  
- **docs/context/** — current status, decisions, roadmap  

Start with AGENTS.md and `docs/context/current-status.md` before contributing.

## License

MIT — see [LICENSE](LICENSE).
