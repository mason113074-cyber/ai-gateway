# CURSOR AI NEXT ORDER — Revenue-Critical Features for AI Gateway

> **目標**：把 MVP 變成能收錢的產品。  
> **市場情報摘要**：83-85% 企業買家要求 SOC 2 才開始採購流程；SSO 是所有競品的 #1 升級觸發器；  
> $299-$999/mo 的 gateway + fintech compliance + CX guardrails 組合目前市場上沒有。  
> Helicone 被 Mintlify 收購後進入維護模式，16,000 個組織正在遷移 — 這是我們的窗口。

---

## MARKET CONTEXT (研究摘要)

```
Portkey:  $15M Series A (Feb 2026), 24K+ orgs, governance gated at $2K+/mo
Langfuse: Acquired by ClickHouse (Jan 2026), SOC2 at $199/mo, still growing  
Helicone: Acquired by Mintlify (Mar 2026), maintenance mode → 16K orgs migrating NOW
LiteLLM:  Enterprise at $30K/yr, budget enforcement unreliable (HN complaints)
Gap:      No product at $299-$999/mo combines gateway + compliance + CX guardrails
```

**Urgency triggers:**
- EU AI Act high-risk deadline: August 2, 2026 (< 5 months)
- SEC 2026 examination priorities include AI supervision
- US Treasury FS AI RMF published Feb 2026
- Average enterprise LLM overspend: 56% above projection

---

## CODEBASE STATE (as of 2026-03-14)

```
repo: mason113074-cyber/ai-gateway (main branch)
All 4 MVP phases are on main:
  Phase 1: LLM Proxy Layer (/v1/* wildcard, SSE streaming, agent identity)
  Phase 2: Agent Registry (auto-register, CRUD API)
  Phase 3: Policy Engine (allow/deny/requires_approval)
  Phase 4: Cost Dashboard + README

monorepo: pnpm workspace + turborepo
  apps/api/         — Fastify 5 API (port 4000)
  apps/web/         — Next.js Admin Console
  packages/domain/  — shared types, policy, registry, log-store
```

---

## FEATURE PRIORITY MATRIX (Research-Backed)

| Priority | Feature | Revenue Impact | Evidence |
|----------|---------|---------------|----------|
| **P0** | Audit Logs (immutable) | BLOCKER for regulated industries | Required for SOX, HIPAA, SR 11-7, EU AI Act; enterprise-gated across all competitors |
| **P0** | Per-Team Cost Attribution | Deal-closer for every enterprise | "Which team is spending what?" — cited in every competitor case study |
| **P0** | Budget Hard Caps per Team/Agent | Prevents deal-killing cost blowouts | LiteLLM's #1 enterprise complaint is unreliable budget enforcement |
| **P1** | RBAC (Role-Based Access Control) | Required for multi-team rollout | Needed before any org with 20+ engineers adopts |
| **P1** | PII Redaction in Prompts | Required for customer-facing AI | HIPAA, GLBA, GDPR; 39% of CX bots were pulled back due to hallucinations |
| **P1** | Persistent Storage (SQLite) | Production-readiness blocker | In-memory store loses data on restart; no one pays for that |
| **P2** | SSO/SAML (Okta, Azure AD) | #1 upgrade trigger across competitors | IT mandates SSO before any new SaaS goes to production |
| **P2** | Rate Limiting per Agent/Team | Prevents "noisy neighbor" problems | Stripe built this exact feature internally |
| **P2** | Docker + Helm Chart | Required for self-host adoption | OSS adoption needs `docker compose up` in < 5 minutes |
| **P3** | OpenTelemetry Export | Enterprise observability integration | Top Langfuse roadmap request; interop with existing stacks |
| **P3** | Semantic Caching | ROI story for CTO pitch | Portkey case study: $500K saved |

---

## EXECUTION PLAN: 6 PHASES

### PHASE 5: Persistent Storage + Audit Logs
### PHASE 6: Per-Team Cost Attribution + Budget Enforcement
### PHASE 7: RBAC System
### PHASE 8: PII Redaction Guardrails
### PHASE 9: Rate Limiting + Noisy Neighbor Prevention
### PHASE 10: Docker Compose + OSS Launch Readiness

---

## PHASE 5: Persistent Storage + Immutable Audit Logs (P0)
**Branch:** `feat/persistent-storage`  
**Estimated time:** 3–4 days  
**Goal:** Replace all in-memory stores with SQLite; add immutable audit log that satisfies SOX/HIPAA/EU AI Act.

### Why This Is First
Everything else depends on data surviving a restart. No enterprise buyer evaluates a tool that loses data on reboot. Audit logs are the single most-requested compliance feature across every competitor.

### Step 5.1: Install dependencies

```bash
cd apps/api
pnpm add better-sqlite3 drizzle-orm
pnpm add -D drizzle-kit @types/better-sqlite3
```

### Step 5.2: Create database schema

**File: `packages/domain/src/db/schema.ts`**

```typescript
import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const proxyLogs = sqliteTable('proxy_logs', {
  id: text('id').primaryKey(),
  timestamp: text('timestamp').notNull(),
  workspaceId: text('workspace_id').notNull().default('default'),
  agentId: text('agent_id').notNull(),
  teamId: text('team_id').notNull(),
  provider: text('provider').notNull(),
  model: text('model').notNull(),
  endpoint: text('endpoint').notNull(),
  requestTokens: integer('request_tokens'),
  responseTokens: integer('response_tokens'),
  totalTokens: integer('total_tokens'),
  latencyMs: integer('latency_ms').notNull(),
  statusCode: integer('status_code').notNull(),
  costUsd: real('cost_usd'),
  error: text('error'),
});

export const agents = sqliteTable('agents', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().default('default'),
  name: text('name').notNull(),
  owner: text('owner'),
  status: text('status').notNull().default('active'),
  allowedTools: text('allowed_tools'),
  allowedDataScopes: text('allowed_data_scopes'),
  autoRegistered: integer('auto_registered').notNull().default(0),
  createdAt: text('created_at').notNull(),
  lastSeenAt: text('last_seen_at'),
});

export const auditLogs = sqliteTable('audit_logs', {
  id: text('id').primaryKey(),
  timestamp: text('timestamp').notNull(),
  workspaceId: text('workspace_id').notNull().default('default'),
  eventType: text('event_type').notNull(),
  actorType: text('actor_type').notNull(),
  actorId: text('actor_id').notNull(),
  targetType: text('target_type'),
  targetId: text('target_id'),
  action: text('action').notNull(),
  outcome: text('outcome').notNull(),
  metadata: text('metadata'),
});
```

### Step 5.3: Create database connection + migration

**File: `packages/domain/src/db/connection.ts`**

```typescript
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';

export function createDatabase(dbPath: string = './data/gateway.db') {
  const sqlite = new Database(dbPath);
  sqlite.pragma('journal_mode = WAL');
  return drizzle(sqlite, { schema });
}
```

Use Drizzle's `migrate()` function or generate SQL from schema. Ensure tables are auto-created on first run.

### Step 5.4: Create SQLite-backed LogStore

**File: `packages/domain/src/db/sqlite-log-store.ts`**

Implement the same `LogStore` interface as `InMemoryLogStore`, but backed by SQLite.
- `append()` → INSERT into proxy_logs
- `list()` → SELECT with WHERE filters + ORDER BY timestamp DESC + LIMIT
- `getStats()` → SELECT with GROUP BY model, SUM(cost_usd), SUM(total_tokens)

### Step 5.5: Create SQLite-backed AgentRegistry

**File: `packages/domain/src/db/sqlite-agent-registry.ts`**

Same `AgentRegistry` interface, backed by SQLite.
- `ensureExists()` → INSERT OR IGNORE + UPDATE last_seen_at
- `list()` → SELECT WHERE workspace_id
- `create()` / `update()` → standard CRUD

### Step 5.6: Create AuditLogger service

**File: `packages/domain/src/audit.ts`**

```typescript
export interface AuditEntry {
  eventType: string;
  actorType: 'agent' | 'user' | 'system';
  actorId: string;
  targetType?: string;
  targetId?: string;
  action: string;
  outcome: 'success' | 'denied' | 'error';
  metadata?: Record<string, unknown>;
}

export interface AuditLogger {
  log(workspaceId: string, entry: AuditEntry): void;
  query(opts: {
    workspaceId: string;
    eventType?: string;
    actorId?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }): { items: AuditEntry[]; total: number };
}
```

Implement `SqliteAuditLogger` — strictly append-only. No update or delete methods.

### Step 5.7: Wire into proxy and API

In `apps/api/src/server.ts`:
1. Replace `new InMemoryLogStore()` with `new SqliteLogStore(db)`
2. Replace `new InMemoryAgentRegistry()` with `new SqliteAgentRegistry(db)`
3. Create `new SqliteAuditLogger(db)`
4. In proxy route: after logging, also call `auditLogger.log()` for every request
5. In policy deny: call `auditLogger.log()` with outcome='denied'
6. Add API endpoint: GET /api/audit-logs with filtering and pagination

### Step 5.8: Audit Logs page in web UI

**File: `apps/web/app/audit/page.tsx`**

Table with columns: Timestamp, Event Type, Actor, Target, Action, Outcome, Details (expandable JSON).
Filters: event type dropdown, date range, actor ID search.
Pagination (server-side via limit/offset).

### Step 5.9: Data directory + gitignore

Create `data/` directory at repo root. Add `data/*.db` to `.gitignore`.
Add `data/.gitkeep` so the directory exists.

### Step 5.10: Tests

- `packages/domain/src/db/sqlite-log-store.test.ts` — append + list + getStats + data persistence
- `packages/domain/src/db/sqlite-agent-registry.test.ts` — CRUD + ensureExists + lastSeenAt
- `packages/domain/src/db/sqlite-audit-logger.test.ts` — append-only + query filters + pagination

### Step 5.11: Commit & PR

```bash
git checkout -b feat/persistent-storage
pnpm turbo check test
git add -A
git commit -m "feat: persistent SQLite storage + immutable audit logs"
git push origin feat/persistent-storage
```

---

## PHASE 6: Per-Team Cost Attribution + Budget Enforcement (P0)
**Branch:** `feat/cost-budgets`  
**Estimated time:** 2–3 days  
**Goal:** Finance can see cost by team/department; hard budget caps prevent runaway spend.

### Why This Is Critical
- "Which team is spending what on AI?" is cited in every enterprise case study
- LiteLLM's #1 HN complaint: budget limits aren't reliably enforced
- Average enterprise overspent AI budgets by 56% in 2025
- One agent stuck in a retry loop can rack up thousands of API calls in minutes

### Step 6.1: Create budget schema

**File: `packages/domain/src/db/schema.ts`** — add team_budgets and agent_budgets tables.

### Step 6.2: Create BudgetManager service

**File: `packages/domain/src/budget.ts`**

```typescript
export interface BudgetCheckResult {
  allowed: boolean;
  teamBudgetRemaining: number | null;
  agentBudgetRemaining: number | null;
  reason?: string;
}

export interface BudgetManager {
  checkBudget(workspaceId: string, teamId: string, agentId: string, estimatedCostUsd: number): BudgetCheckResult;
  recordSpend(workspaceId: string, teamId: string, agentId: string, costUsd: number): void;
  setTeamBudget(workspaceId: string, teamId: string, monthlyBudgetUsd: number, hardCap?: boolean): void;
  setAgentBudget(workspaceId: string, agentId: string, dailyBudgetUsd: number, hardCap?: boolean): void;
  getTeamBudget(workspaceId: string, teamId: string): any;
  getAgentBudget(workspaceId: string, agentId: string): any;
  listTeamBudgets(workspaceId: string): any[];
  resetDailyBudgets(workspaceId: string): void;
  resetMonthlyBudgets(workspaceId: string): void;
}
```

**CRITICAL — Reliable enforcement:** Use SQLite transactions (BEGIN IMMEDIATE) for atomic check + update. This is the exact problem LiteLLM fails on.

### Step 6.3: Token-to-cost estimation

**File: `packages/domain/src/cost-estimator.ts`** — per-model cost table for gpt-4o, claude-3-5-sonnet, etc.

### Step 6.4: Wire budget check into proxy (429 on exceed)

### Step 6.5: Budget API endpoints (CRUD for team/agent budgets, cost attribution with groupBy)

### Step 6.6: Cost Attribution dashboard page (apps/web/app/costs/page.tsx)

### Step 6.7: Tests (budget enforcement reliability, concurrent access)

### Step 6.8: Commit & PR

```bash
git checkout -b feat/cost-budgets
pnpm turbo check test
git commit -m "feat: per-team cost attribution + budget enforcement"
git push origin feat/cost-budgets
```

---

## PHASE 7: RBAC System (P1)
**Branch:** `feat/rbac`  
**Estimated time:** 2–3 days  
**Goal:** Who can use which model, who can set budgets, who can view audit logs.

### Step 7.1: users and api_keys tables
### Step 7.2: Permission system (proxy, read:logs, read:audit, write:budgets, admin, etc.)
### Step 7.3: API Key auth middleware (gw- prefix, SHA-256 hash)
### Step 7.4: Permission enforcement on all routes
### Step 7.5: API Key management endpoints (create/list/revoke)
### Step 7.6: Model allowlist per key
### Step 7.7: API Keys UI page
### Step 7.8: Tests
### Step 7.9: Commit & PR

See full details in the complete document.

---

## PHASE 8: PII Redaction Guardrails (P1)
**Branch:** `feat/pii-redaction`  
**Estimated time:** 2 days  
**Goal:** Auto-detect and redact PII in prompts before forwarding to LLM providers.

### Step 8.1: Regex-based PII detector (email, phone, SSN, credit card, API keys)
### Step 8.2: guardrail_configs table
### Step 8.3: Wire PII check into proxy (redact/warn/block modes)
### Step 8.4: Guardrail configuration API
### Step 8.5: Guardrails UI page
### Step 8.6: Tests
### Step 8.7: Commit & PR

See full details in the complete document.

---

## PHASE 9: Rate Limiting + Noisy Neighbor Prevention (P2)
**Branch:** `feat/rate-limiting`  
**Estimated time:** 2 days  
**Goal:** Per-agent and per-team rate limits; prevent one team from monopolizing LLM bandwidth.

### Step 9.1: Sliding window rate limiter (SQLite-backed)
### Step 9.2: Rate limit configuration per team/agent
### Step 9.3: Wire into proxy (standard rate limit headers)
### Step 9.4: Rate limit management API
### Step 9.5: Dashboard section
### Step 9.6: Tests & Commit

See full details in the complete document.

---

## PHASE 10: Docker Compose + OSS Launch Readiness (P2)
**Branch:** `feat/docker-launch`  
**Estimated time:** 2 days  
**Goal:** `docker compose up` in under 5 minutes; OSS launch-ready.

### Step 10.1: Multi-stage Dockerfiles (api + web)
### Step 10.2: docker-compose.yml with health checks
### Step 10.3: README.md full rewrite (Docker quick-start, feature table, API reference)
### Step 10.4: CONTRIBUTING.md
### Step 10.5: MIT LICENSE
### Step 10.6: .env.example
### Step 10.7: GitHub Actions CI
### Step 10.8: Commit & PR

See full details in the complete document.

---

## CURSOR PROMPT SEQUENCE

Copy-paste these prompts into Cursor Agent mode, one phase at a time.

### Prompt 5 (Phase 5):
```
Read docs/CURSOR_NEXT_ORDER.md. Execute Phase 5: Persistent Storage + Immutable Audit Logs.
Branch: feat/persistent-storage
After implementation, run: pnpm turbo check test
```

### Prompt 6 (Phase 6):
```
Read docs/CURSOR_NEXT_ORDER.md. Execute Phase 6: Per-Team Cost Attribution + Budget Enforcement.
Branch: feat/cost-budgets
After implementation, run: pnpm turbo check test
```

### Prompt 7 (Phase 7):
```
Read docs/CURSOR_NEXT_ORDER.md. Execute Phase 7: RBAC System.
Branch: feat/rbac
After implementation, run: pnpm turbo check test
```

### Prompt 8 (Phase 8):
```
Read docs/CURSOR_NEXT_ORDER.md. Execute Phase 8: PII Redaction Guardrails.
Branch: feat/pii-redaction
After implementation, run: pnpm turbo check test
```

### Prompt 9 (Phase 9):
```
Read docs/CURSOR_NEXT_ORDER.md. Execute Phase 9: Rate Limiting.
Branch: feat/rate-limiting
After implementation, run: pnpm turbo check test
```

### Prompt 10 (Phase 10):
```
Read docs/CURSOR_NEXT_ORDER.md. Execute Phase 10: Docker Compose + OSS Launch.
Branch: feat/docker-launch
After implementation, run: pnpm turbo check test build && docker compose build
```

---

## POST-EXECUTION: Revenue Readiness Checklist

After all 6 phases are merged to main:

### Immediate (Week 1):
- [ ] Create GitHub Release v0.1.0
- [ ] Post on Show HN (Tuesday/Wednesday 8-11am UTC)
- [ ] Post on r/LLMDevs
- [ ] Post on r/LocalLLaMA

### Week 2–4:
- [ ] Target Helicone migration (16K orgs looking)
- [ ] Write comparison blog
- [ ] LinkedIn build-in-public posts (weekly)

### Month 2–3:
- [ ] Identify corporate email signups → direct outreach
- [ ] SOC 2 Type II readiness (start process)
- [ ] SSO/SAML integration
- [ ] VPC deployment documentation

### Pricing (when ready):
```
Free (OSS):     Self-host, unlimited routing, 5 users, 14-day logs
Team ($299/mo): 20 users, SSO, 90-day retention, SOC 2 report
Business ($999/mo): Unlimited users, RBAC, VPC docs, HIPAA BAA, 1-year retention
```

---

## COMPETITIVE COMPARISON

```
                    Gateway  Cost   Audit   PII    Agent ID   Budget   RBAC   Price
Portkey Enterprise    ✅      ✅     ✅      ✅      ❌         ✅       ✅    $2K+/mo
Langfuse Pro          ❌      ✅     ✅      ❌      ❌         ❌       ✅    $199/mo
LiteLLM Enterprise    ✅      ✅     ✅      ❌      ❌         ⚠️       ✅    $2.5K/mo
Helicone              ✅      ✅     ❌      ✅      ❌         ❌       ❌    Maintenance mode
═══════════════════════════════════════════════════════════════════════════════════
AI Gateway (us)       ✅      ✅     ✅      ✅      ✅         ✅       ✅    Free (OSS)
AI Gateway Team       ✅      ✅     ✅      ✅      ✅         ✅       ✅    $299/mo
```

**Our unique differentiator:** Agent-level identity tagging (`x-agent-id`) as a first-class concept.

---

*This document continues from CURSOR_MASTER_ORDER.md (Phases 1–4). Execute Phases 5–10 sequentially.*