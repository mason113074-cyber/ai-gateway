# CURSOR AI MASTER ORDER — AI Gateway Proxy-First MVP

> **策略轉向**：從 Control-Plane-First 轉為 **Proxy-First**。
> 本文件是 Cursor AI 的完整執行指令，按順序執行 Phase 1→2→3→4。
> 每個 Phase 完成後，跑 `pnpm turbo check test` 確認全綠再進下一個。

---

## CURRENT CODEBASE STATE (as of 2026-03-14)

```
repo: mason113074-cyber/ai-gateway (main branch: a5ce9aa)
monorepo: pnpm workspace + turborepo

apps/api/         — Fastify 5 API (port 4000)
  src/server.ts   — health, /api/session, /api/agents (mock), /api/policy/evaluate
  src/auth-middleware.ts — reads x-workspace-id, x-user-id headers (T001 done)
  src/context.ts, types.d.ts

apps/web/         — Next.js Admin Console (skeleton)

packages/domain/  — @agent-control-tower/domain
  src/types.ts    — AgentRecord, ActionRequest, PolicyDecision, ApprovalRecord, AuditEvent
  src/policy.ts   — evaluatePolicy() → riskLevel + requiresApproval + reasons
  src/workspace.ts, workspace.test.ts — workspace/role helpers (T001)
  src/mock.ts     — mockAgents, mockApprovals, mockAuditEvents
  src/index.ts    — barrel export

Open issues: T002 (#3), T003 (#4)
Existing branches: main, feat/t001-workspace-auth-scaffold, chore/cursor-operating-system
```

---

## PHASE 1: LLM Proxy Layer (Priority: HIGHEST — do this FIRST)
**Branch:** `feat/proxy-layer`
**Estimated time:** 2–3 days
**Goal:** Users change ONE base URL and all LLM calls are proxied, logged, and tagged with agent identity.

### Step 1.1: Install dependencies

```bash
cd apps/api
pnpm add undici dotenv
# undici for streaming HTTP proxy (Node built-in, but explicit import is cleaner)
```

### Step 1.2: Create proxy types in domain

**File: `packages/domain/src/proxy-types.ts`**

```typescript
export interface ProxyRequestLog {
  id: string;
  timestamp: string;
  workspaceId: string;
  agentId: string;       // from x-agent-id header
  teamId: string;        // from x-team-id header
  provider: string;      // "openai" | "anthropic" | "google" | etc
  model: string;         // extracted from request body
  endpoint: string;      // e.g., "/v1/chat/completions"
  requestTokens: number | null;
  responseTokens: number | null;
  totalTokens: number | null;
  latencyMs: number;
  statusCode: number;
  costUsd: number | null;   // estimated from token counts
  error: string | null;
}

export interface ProxyConfig {
  providers: Record<string, {
    baseUrl: string;
    apiKeyEnvVar: string; // env var name that holds the API key
  }>;
}

export const DEFAULT_PROVIDERS: ProxyConfig['providers'] = {
  openai: {
    baseUrl: 'https://api.openai.com',
    apiKeyEnvVar: 'OPENAI_API_KEY',
  },
  anthropic: {
    baseUrl: 'https://api.anthropic.com',
    apiKeyEnvVar: 'ANTHROPIC_API_KEY',
  },
};
```

Export from `packages/domain/src/index.ts`.

### Step 1.3: Create in-memory log store

**File: `packages/domain/src/log-store.ts`**

```typescript
import type { ProxyRequestLog } from './proxy-types';

export interface LogStore {
  append(log: ProxyRequestLog): void;
  list(opts?: { agentId?: string; teamId?: string; limit?: number }): ProxyRequestLog[];
  getStats(opts?: { agentId?: string; teamId?: string }): {
    totalRequests: number;
    totalCostUsd: number;
    totalTokens: number;
    byModel: Record<string, { requests: number; costUsd: number; tokens: number }>;
  };
}

export class InMemoryLogStore implements LogStore {
  private logs: ProxyRequestLog[] = [];

  append(log: ProxyRequestLog): void {
    this.logs.push(log);
  }

  list(opts?: { agentId?: string; teamId?: string; limit?: number }): ProxyRequestLog[] {
    let result = this.logs;
    if (opts?.agentId) result = result.filter(l => l.agentId === opts.agentId);
    if (opts?.teamId) result = result.filter(l => l.teamId === opts.teamId);
    result = result.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    if (opts?.limit) result = result.slice(0, opts.limit);
    return result;
  }

  getStats(opts?: { agentId?: string; teamId?: string }) {
    const filtered = this.list(opts);
    const byModel: Record<string, { requests: number; costUsd: number; tokens: number }> = {};
    let totalCostUsd = 0;
    let totalTokens = 0;

    for (const log of filtered) {
      const m = log.model || 'unknown';
      if (!byModel[m]) byModel[m] = { requests: 0, costUsd: 0, tokens: 0 };
      byModel[m].requests++;
      byModel[m].costUsd += log.costUsd ?? 0;
      byModel[m].tokens += log.totalTokens ?? 0;
      totalCostUsd += log.costUsd ?? 0;
      totalTokens += log.totalTokens ?? 0;
    }

    return { totalRequests: filtered.length, totalCostUsd, totalTokens, byModel };
  }
}
```

Add tests in `packages/domain/src/log-store.test.ts`.

### Step 1.4: Create proxy route handler

**File: `apps/api/src/proxy.ts`**

Core logic:
1. Catch all requests to `/v1/*` (matches OpenAI API paths like `/v1/chat/completions`, `/v1/embeddings`, etc.)
2. Read headers: `x-agent-id`, `x-team-id`, `authorization` (passthrough to upstream)
3. Determine provider from path or `x-provider` header (default: openai)
4. Forward request to upstream provider with streaming support (SSE passthrough)
5. Capture: model (from request body), token usage (from response), latency
6. Log to InMemoryLogStore
7. Return upstream response to caller transparently

**Key implementation details:**
- Use Fastify's `request.raw` and `reply.raw` for streaming proxy (SSE)
- Parse `request.body` to extract `model` field before forwarding
- For streaming responses (`stream: true`), collect final usage from the last SSE chunk (`[DONE]` or `usage` field)
- Add `x-proxy-latency-ms` response header
- Set `content-type` from upstream response (passthrough)
- Handle errors: if upstream returns 4xx/5xx, log it and passthrough

```typescript
// Simplified signature — implement the full version
import { InMemoryLogStore } from '@agent-control-tower/domain';

const logStore = new InMemoryLogStore();

export function registerProxyRoutes(app: FastifyInstance) {
  // Wildcard route for /v1/*
  app.all('/v1/*', async (request, reply) => {
    const startTime = Date.now();
    const agentId = request.headers['x-agent-id'] as string || 'anonymous';
    const teamId = request.headers['x-team-id'] as string || 'default';
    const provider = request.headers['x-provider'] as string || 'openai';

    // Determine upstream URL
    // Forward request (handle streaming)
    // Capture response
    // Log to store
    // Return response
  });
}
```

### Step 1.5: Add log query API endpoints

**In `apps/api/src/server.ts`, add:**

```typescript
// GET /api/logs — query proxy logs
app.get('/api/logs', async (request) => {
  const { agentId, teamId, limit } = request.query as any;
  return { items: logStore.list({ agentId, teamId, limit: limit ? Number(limit) : 100 }) };
});

// GET /api/stats — aggregated stats by agent/team/model
app.get('/api/stats', async (request) => {
  const { agentId, teamId } = request.query as any;
  return logStore.getStats({ agentId, teamId });
});
```

### Step 1.6: Update .env.example

```
PORT=4000
OPENAI_API_KEY=sk-your-key-here
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

### Step 1.7: Tests

**File: `apps/api/src/proxy.test.ts`**
- Test that `/v1/chat/completions` returns 502 when no upstream key configured
- Test that headers `x-agent-id` and `x-team-id` are logged
- Test that `/api/logs` returns logged requests
- Test that `/api/stats` returns aggregated data

**File: `packages/domain/src/log-store.test.ts`**
- Test append + list
- Test filtering by agentId, teamId
- Test getStats aggregation

### Step 1.8: Commit & PR

```bash
git checkout -b feat/proxy-layer
# ... implement all above
pnpm turbo check test
git add -A
git commit -m "feat: add LLM proxy layer with agent identity tagging and cost tracking

- Add /v1/* wildcard proxy route (streams SSE)
- Auto-tag requests with x-agent-id and x-team-id
- In-memory log store with query and stats APIs
- GET /api/logs, GET /api/stats endpoints
- Domain: ProxyRequestLog type, InMemoryLogStore

Refs #3"
git push origin feat/proxy-layer
```

---

## PHASE 2: Agent Registry with Auto-Register (Closes T002 / Issue #3)
**Branch:** `feat/t002-agent-registry`
**Estimated time:** 1–2 days
**Goal:** Agents auto-register on first proxy request; CRUD API for management.

### Step 2.1: Create AgentRegistry interface in domain

**File: `packages/domain/src/agent-registry.ts`**

```typescript
import type { AgentRecord } from './types';

export interface AgentRegistry {
  list(workspaceId: string): AgentRecord[];
  getById(workspaceId: string, id: string): AgentRecord | undefined;
  create(workspaceId: string, agent: Omit<AgentRecord, 'id'>): AgentRecord;
  update(workspaceId: string, id: string, patch: Partial<Omit<AgentRecord, 'id'>>): AgentRecord | undefined;
  ensureExists(workspaceId: string, agentId: string): AgentRecord;
  // ensureExists: auto-registers if not found (for proxy auto-registration)
}
```

Implement `InMemoryAgentRegistry`.

### Step 2.2: Wire into proxy

In `apps/api/src/proxy.ts`, before logging each request:
```typescript
// Auto-register agent if it doesn't exist yet
agentRegistry.ensureExists(workspaceId, agentId);
```

### Step 2.3: CRUD API endpoints

**In `apps/api/src/server.ts`:**

```typescript
// Replace mock agents endpoint with real registry
app.get('/api/agents', async (request) => {
  const workspaceId = (request as any).workspaceId || 'default';
  return { items: agentRegistry.list(workspaceId) };
});

app.post('/api/agents', async (request) => {
  const workspaceId = (request as any).workspaceId || 'default';
  const body = request.body as Omit<AgentRecord, 'id'>;
  const agent = agentRegistry.create(workspaceId, body);
  return agent;
});

app.patch('/api/agents/:id', async (request) => {
  const workspaceId = (request as any).workspaceId || 'default';
  const { id } = request.params as { id: string };
  const body = request.body as Partial<Omit<AgentRecord, 'id'>>;
  const agent = agentRegistry.update(workspaceId, id, body);
  if (!agent) throw { statusCode: 404, message: 'Agent not found' };
  return agent;
});
```

### Step 2.4: Basic Web UI for agent list

**File: `apps/web/app/agents/page.tsx`**

Server component that fetches from `/api/agents` and renders a table:
- Columns: Name, Status, Owner, Allowed Tools, Last Seen (from logs)
- Show "auto-registered" badge for agents created by proxy
- Link to edit page

**File: `apps/web/app/agents/[id]/edit/page.tsx`**

Simple form: name, owner, status, allowedTools, allowedDataScopes.

### Step 2.5: Tests

- Domain: test InMemoryAgentRegistry CRUD + ensureExists
- API: test GET/POST/PATCH /api/agents
- API: test that proxy auto-registers unknown agents

### Step 2.6: Commit & PR

```bash
git checkout -b feat/t002-agent-registry
# implement
pnpm turbo check test
git commit -m "feat(T002): agent registry with auto-register on proxy request

- AgentRegistry interface + InMemoryAgentRegistry in domain
- Auto-register agents on first proxy request via ensureExists()
- GET/POST/PATCH /api/agents endpoints (replace mock data)
- Agent list and edit pages in apps/web
- Domain tests for registry interface

Closes #3"
```

---

## PHASE 3: Policy Evaluation Endpoint Enhancement (Closes T003 / Issue #4)
**Branch:** `feat/t003-policy-evaluation`
**Estimated time:** 1–2 days
**Goal:** Extend policy to return allow/deny/requires_approval decision; expose via POST endpoint.

### Step 3.1: Extend PolicyDecision type

**File: `packages/domain/src/types.ts`** — add:

```typescript
export type PolicyVerdict = 'allow' | 'deny' | 'requires_approval';

export interface PolicyDecision {
  verdict: PolicyVerdict;       // NEW — replaces implicit logic
  riskLevel: RiskLevel;
  requiresApproval: boolean;    // keep for backward compat
  reasons: string[];
  rationale: string;            // NEW — human-readable summary
}
```

### Step 3.2: Extend evaluatePolicy()

**File: `packages/domain/src/policy.ts`**

```typescript
export function evaluatePolicy(action: ActionRequest): PolicyDecision {
  // ... existing risk logic ...

  // Determine verdict
  let verdict: PolicyVerdict = 'allow';
  if (riskLevel === 'high' && requiresApproval) {
    verdict = 'requires_approval';
  }

  // Add deny rules:
  // - If agent is disabled → deny
  // - If action targets a blocked resource → deny
  // Example: certain action types can be outright denied
  if (action.actionType === 'delete' && action.external) {
    verdict = 'deny';
    reasons.push('External delete operations are not permitted.');
  }

  const rationale = reasons.join(' ');

  return { verdict, riskLevel, requiresApproval, reasons, rationale };
}
```

### Step 3.3: Rate limiting integration

Add rate limiting check to the proxy:
```typescript
// In proxy route, after logging:
const decision = evaluatePolicy({
  actionType: 'write', // LLM calls are effectively "write" operations
  target: model,
  external: true,
  amount: estimatedCostUsd,
});

if (decision.verdict === 'deny') {
  reply.status(403).send({
    error: 'Policy denied',
    rationale: decision.rationale,
  });
  return;
}
```

### Step 3.4: Tests

**File: `packages/domain/src/policy.test.ts`** — extend:
- Test verdict = 'allow' for read operations
- Test verdict = 'requires_approval' for high-risk write
- Test verdict = 'deny' for external delete
- Test rationale string is human-readable

### Step 3.5: Commit & PR

```bash
git checkout -b feat/t003-policy-evaluation
pnpm turbo check test
git commit -m "feat(T003): extend policy to allow/deny/requires_approval with rationale

- Add PolicyVerdict type and rationale field
- evaluatePolicy returns explicit verdict
- Integrate policy check into proxy route (deny = 403)
- Full domain test coverage for all three outcomes

Closes #4"
```

---

## PHASE 4: Cost Dashboard + README for OSS Launch
**Branch:** `feat/cost-dashboard`
**Estimated time:** 2 days
**Goal:** Admin console shows real-time cost data by agent/team/model.

### Step 4.1: Dashboard page

**File: `apps/web/app/dashboard/page.tsx`**

Fetch from `/api/stats` and render:
- Total spend (USD) card
- Total requests card
- Total tokens card
- Table: breakdown by model (requests, tokens, cost)
- Table: breakdown by agent (requests, tokens, cost)
- Time selector: last 1h / 24h / 7d (client-side filter)

Use Tailwind CSS (already in Next.js). No charting library needed — use simple HTML tables + conditional color bars for v1.

### Step 4.2: Landing/overview page

**File: `apps/web/app/page.tsx`**

Replace default Next.js page with:
- Product name: "AI Gateway" with tagline "Agent Governance Control Plane"
- Quick stat cards (total agents, total requests, total cost)
- Navigation to /dashboard, /agents, /logs

### Step 4.3: Logs page

**File: `apps/web/app/logs/page.tsx`**

Fetch from `/api/logs` and render:
- Table: timestamp, agentId, teamId, model, tokens, cost, latency, status
- Filter by agentId, teamId
- Pagination (client-side for v1)

### Step 4.4: Update README.md for OSS

**File: `README.md`** — complete rewrite:

```markdown
# AI Gateway

Open-source LLM proxy with agent identity, cost tracking, and governance.

## Quick Start

1. Change your OpenAI base URL:
   ```
   # Before
   https://api.openai.com/v1

   # After
   http://localhost:4000/v1
   ```

2. Add agent identity headers:
   ```
   x-agent-id: my-support-bot
   x-team-id: cx-team
   ```

3. Every LLM call is now automatically:
   - Logged with agent identity
   - Tracked for cost and token usage
   - Evaluated against your governance policies

## Features

- **One-line integration** — just change your base URL
- **Agent identity tagging** — every request tagged to a specific agent and team
- **Cost tracking** — real-time per-agent, per-team, per-model cost breakdown
- **Policy engine** — allow / deny / requires_approval decisions
- **Rate limiting** — per-agent and per-team limits
- **Admin console** — Next.js dashboard for visibility

## Architecture

- `apps/api` — Fastify proxy + control API
- `apps/web` — Next.js admin console
- `packages/domain` — Policy engine + shared types

## Development

```bash
pnpm install
pnpm turbo dev
```

## License

MIT (proxy + logging) — see LICENSE
```

### Step 4.5: Commit & PR

```bash
git checkout -b feat/cost-dashboard
pnpm turbo check test build
git commit -m "feat: cost dashboard, logs viewer, and OSS-ready README

- Dashboard page with cost/token/request stats by agent and model
- Logs page with filtering
- Agent list integrated with real registry data
- README rewritten for OSS launch (quick-start in 3 lines)
- Landing page with product positioning"
```

---

## EXECUTION CHECKLIST

Run these in Cursor AI sequentially. After each phase, verify:

```bash
pnpm turbo check    # TypeScript compiles
pnpm turbo test     # All tests pass
pnpm turbo build    # Production build succeeds
```

### Phase 1 (Proxy Layer):
- [ ] `packages/domain/src/proxy-types.ts` — ProxyRequestLog, ProxyConfig, DEFAULT_PROVIDERS
- [ ] `packages/domain/src/log-store.ts` — InMemoryLogStore
- [ ] `packages/domain/src/log-store.test.ts` — tests
- [ ] `packages/domain/src/index.ts` — export new modules
- [ ] `apps/api/src/proxy.ts` — /v1/* wildcard proxy with streaming SSE
- [ ] `apps/api/src/server.ts` — register proxy routes + /api/logs + /api/stats
- [ ] `apps/api/src/proxy.test.ts` — tests
- [ ] `.env.example` — add OPENAI_API_KEY, ANTHROPIC_API_KEY
- [ ] `apps/api/package.json` — add undici if needed

### Phase 2 (Agent Registry — closes #3):
- [ ] `packages/domain/src/agent-registry.ts` — interface + InMemoryAgentRegistry
- [ ] `packages/domain/src/agent-registry.test.ts` — tests
- [ ] `apps/api/src/server.ts` — replace mock /api/agents with registry CRUD
- [ ] `apps/api/src/proxy.ts` — call ensureExists() on each request
- [ ] `apps/web/app/agents/page.tsx` — agent list table
- [ ] `apps/web/app/agents/[id]/edit/page.tsx` — edit form

### Phase 3 (Policy Enhancement — closes #4):
- [ ] `packages/domain/src/types.ts` — add PolicyVerdict, rationale
- [ ] `packages/domain/src/policy.ts` — extend evaluatePolicy with verdict + deny rules
- [ ] `packages/domain/src/policy.test.ts` — test all three outcomes
- [ ] `apps/api/src/proxy.ts` — integrate policy check (deny = 403)

### Phase 4 (Dashboard + README):
- [ ] `apps/web/app/dashboard/page.tsx` — cost dashboard
- [ ] `apps/web/app/logs/page.tsx` — log viewer
- [ ] `apps/web/app/page.tsx` — landing/overview
- [ ] `README.md` — OSS-ready quick-start

---

## CURSOR PROMPT SEQUENCE

Copy-paste these prompts into Cursor Agent mode, one phase at a time:

### Prompt 1 (Phase 1):
```
Read CURSOR_MASTER_ORDER.md from the repo root. Execute Phase 1: LLM Proxy Layer.

Follow the exact file structure and implementation details in the document.
Key requirements:
1. /v1/* wildcard route in Fastify that proxies to OpenAI/Anthropic
2. Support SSE streaming (stream: true in request body)
3. Read x-agent-id and x-team-id headers for identity tagging
4. InMemoryLogStore in packages/domain
5. GET /api/logs and GET /api/stats endpoints
6. Tests for domain (log-store) and API (proxy)
7. Update .env.example

Branch: feat/proxy-layer
After implementation, run: pnpm turbo check test
Fix any errors before committing.
```

### Prompt 2 (Phase 2):
```
Read CURSOR_MASTER_ORDER.md. Execute Phase 2: Agent Registry (T002).

Key requirements:
1. AgentRegistry interface in packages/domain with ensureExists()
2. Auto-register agents on first proxy request
3. Replace mock /api/agents with real CRUD (GET/POST/PATCH)
4. Agent list page and edit form in apps/web
5. Tests for domain registry

Branch: feat/t002-agent-registry
Closes #3
After implementation, run: pnpm turbo check test
```

### Prompt 3 (Phase 3):
```
Read CURSOR_MASTER_ORDER.md. Execute Phase 3: Policy Evaluation (T003).

Key requirements:
1. Add PolicyVerdict type (allow/deny/requires_approval) and rationale field
2. Extend evaluatePolicy() with explicit verdict
3. Add deny rules (external delete = deny)
4. Integrate policy check into proxy (deny returns 403)
5. Full test coverage for all three outcomes

Branch: feat/t003-policy-evaluation
Closes #4
After implementation, run: pnpm turbo check test
```

### Prompt 4 (Phase 4):
```
Read CURSOR_MASTER_ORDER.md. Execute Phase 4: Cost Dashboard + README.

Key requirements:
1. Dashboard page: cost/token/request stats by agent and model
2. Logs page: filterable request log table
3. Landing page with product positioning
4. README rewritten for OSS launch (3-line quick-start)
5. All pages use Tailwind CSS, no external charting library

Branch: feat/cost-dashboard
After implementation, run: pnpm turbo check test build
```

---

## POST-EXECUTION: GitHub Issues to Close

After all PRs are merged:
- Close #3 (T002: Agent registry CRUD skeleton) — completed in Phase 2
- Close #4 (T003: Policy evaluation endpoint) — completed in Phase 3
- Close #2 (T001) if still open — was already done in scaffold

## POST-EXECUTION: New Issues to Create

```
T-PROXY-001: Add support for Anthropic Messages API (/v1/messages)
T-PROXY-002: Add support for Google Gemini API
T-PROXY-003: Token cost estimation by model (gpt-4o, claude-3.5, etc.)
T-PROXY-004: Rate limiting per agent (configurable via API)
T-PROXY-005: Persistent storage (SQLite → PostgreSQL migration path)
T-PROXY-006: OpenTelemetry export for traces
T-PROXY-007: GitHub Actions: auto-build Docker image on main push
T-OSS-001: Write CONTRIBUTING.md + LICENSE (MIT)
T-OSS-002: Show HN post draft
T-OSS-003: Loom demo video script
```