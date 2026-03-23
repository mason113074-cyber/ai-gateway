# AI Gateway

Open-source LLM proxy with agent identity, cost tracking, governance, and guardrails. Self-host in under 5 minutes.

## Who is this for?

- **Engineering teams** routing OpenAI/Anthropic traffic through a single control plane
- **Compliance-conscious orgs** that need immutable audit logs and PII redaction
- **Product teams** that want per-agent and per-team cost attribution and rate limits

## Docker Quick Start

```bash
git clone https://github.com/mason113074-cyber/ai-gateway.git
cd ai-gateway
cp .env.example .env
# Edit .env and set OPENAI_API_KEY and ANTHROPIC_API_KEY
# (Optional) Set DATABASE_URL=postgres://user:pass@host:port/db for PostgreSQL
docker compose up -d
```

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

## Features

| Feature | Description |
|--------|-------------|
| **LLM proxy** | `/v1/*` wildcard, SSE streaming, OpenAI + Anthropic |
| **Agent registry** | Auto-register agents, CRUD API |
| **Policy engine** | Allow / deny / requires_approval |
| **Cost dashboard** | Per-agent, per-team, per-model cost and tokens |
| **Persistent storage** | SQLite (WAL) or PostgreSQL, proxy logs, agents, audit logs |
| **Smart Routing** | Automatic fallback between providers (OpenAI ↔ Anthropic) |
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
| GET | `/api/agents` | List agents |
| POST | `/api/agents` | Create agent |
| PATCH | `/api/agents/:id` | Update agent |
| GET | `/api/audit-logs` | Query audit log (filters, pagination) |
| GET | `/api/guardrails` | List guardrail configs |
| POST | `/api/guardrails` | Create/update guardrail |
| PATCH | `/api/guardrails/:id` | Enable/disable guardrail |
| GET | `/api/rate-limits` | List rate limit configs |
| POST | `/api/rate-limits` | Create/update rate limit |
| DELETE | `/api/rate-limits/:id` | Remove rate limit |
| GET | `/api/rate-limits/status` | Current usage per config |
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
| GET | `/api/keys` | List API keys |
| PATCH | `/api/keys/:id` | Update key |
| DELETE | `/api/keys/:id` | Revoke key |

Authenticate with header: `Authorization: Bearer gw-<key>` (create keys via `/api/keys` with permission `manage:keys`).

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
