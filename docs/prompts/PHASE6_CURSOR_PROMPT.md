# Phase 6: Per-Team Cost Attribution + Budget Enforcement

> **前置條件**：Phase 5 (Persistent Storage + Audit Logs) 已合併到 main。
> **Branch**：`feat/cost-budgets`
> **預估時間**：2–3 天
> **目標**：Finance 可以看到每個 team/agent 的 AI 花費；hard budget caps 防止超支。

---

## 背景 WHY

- "Which team is spending what on AI?" — 每個企業案例必問
- LiteLLM 在 HN 上的 #1 抱怨：budget limits 不可靠
- 2025 年企業平均 AI 預算超支 56%
- 一個 agent stuck in retry loop 幾分鐘就能燒掉數千次 API calls

---

## TASK SEQUENCE（按順序執行）

### Task 1: 建立新分支 + 安裝依賴

```bash
git checkout main
git pull origin main
git checkout -b feat/cost-budgets
```

確認 Phase 5 的 better-sqlite3 + drizzle-orm 已在 `apps/api/package.json`。如果沒有：
```bash
cd apps/api
pnpm add better-sqlite3 drizzle-orm
pnpm add -D @types/better-sqlite3
```

---

### Task 2: 擴展 DB Schema — 新增 team_budgets + agent_budgets

**修改檔案：`packages/domain/src/db/schema.ts`**

在現有的 `proxyLogs`, `agents`, `auditLogs` 之後新增：

```typescript
export const teamBudgets = sqliteTable('team_budgets', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull(),
  teamId: text('team_id').notNull(),
  monthlyBudgetUsd: real('monthly_budget_usd').notNull(),
  currentSpendUsd: real('current_spend_usd').notNull().default(0),
  periodStart: text('period_start').notNull(),  // ISO date: 每月 1 號
  periodEnd: text('period_end').notNull(),
  hardCap: integer('hard_cap').notNull().default(1),  // 1=true: 超過就擋
  alertThresholdPct: integer('alert_threshold_pct').notNull().default(80),
  status: text('status').notNull().default('active'),  // 'active' | 'exceeded' | 'paused'
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const agentBudgets = sqliteTable('agent_budgets', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull(),
  agentId: text('agent_id').notNull(),
  dailyBudgetUsd: real('daily_budget_usd').notNull(),
  currentSpendUsd: real('current_spend_usd').notNull().default(0),
  periodStart: text('period_start').notNull(),  // ISO date: 今天
  hardCap: integer('hard_cap').notNull().default(1),
  status: text('status').notNull().default('active'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});
```

**同時更新 `packages/domain/src/db/connection.ts`**：在 `CREATE TABLE IF NOT EXISTS` 區塊加上這兩張表的 DDL。

---

### Task 3: 建立 CostEstimator 模組

**新建檔案：`packages/domain/src/cost-estimator.ts`**

```typescript
// Per-model cost table (USD per 1K tokens)
export const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  'gpt-4o':             { input: 0.0025,  output: 0.01   },
  'gpt-4o-mini':        { input: 0.00015, output: 0.0006 },
  'gpt-4-turbo':        { input: 0.01,    output: 0.03   },
  'gpt-3.5-turbo':      { input: 0.0005,  output: 0.0015 },
  'claude-3-5-sonnet':  { input: 0.003,   output: 0.015  },
  'claude-3-5-haiku':   { input: 0.0008,  output: 0.004  },
  'claude-3-opus':      { input: 0.015,   output: 0.075  },
};

export function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const costs = MODEL_COSTS[model] || MODEL_COSTS['gpt-4o']; // fallback
  return (inputTokens / 1000) * costs.input + (outputTokens / 1000) * costs.output;
}
```

**新建測試：`packages/domain/src/cost-estimator.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { estimateCost, MODEL_COSTS } from './cost-estimator';

describe('estimateCost', () => {
  it('should calculate cost for known model', () => {
    // gpt-4o: input=0.0025/1K, output=0.01/1K
    const cost = estimateCost('gpt-4o', 1000, 500);
    expect(cost).toBeCloseTo(0.0025 + 0.005); // 0.0075
  });

  it('should fallback to gpt-4o for unknown model', () => {
    const cost = estimateCost('unknown-model', 1000, 1000);
    const expected = (1000 / 1000) * MODEL_COSTS['gpt-4o'].input + (1000 / 1000) * MODEL_COSTS['gpt-4o'].output;
    expect(cost).toBeCloseTo(expected);
  });

  it('should handle zero tokens', () => {
    expect(estimateCost('gpt-4o', 0, 0)).toBe(0);
  });
});
```

---

### Task 4: 建立 BudgetManager service

**新建檔案：`packages/domain/src/budget.ts`**

這是整個 Phase 6 最關鍵的模組。要求：

```typescript
export interface TeamBudget {
  id: string;
  workspaceId: string;
  teamId: string;
  monthlyBudgetUsd: number;
  currentSpendUsd: number;
  periodStart: string;
  periodEnd: string;
  hardCap: boolean;
  alertThresholdPct: number;
  status: 'active' | 'exceeded' | 'paused';
}

export interface AgentBudget {
  id: string;
  workspaceId: string;
  agentId: string;
  dailyBudgetUsd: number;
  currentSpendUsd: number;
  periodStart: string;
  hardCap: boolean;
  status: 'active' | 'exceeded' | 'paused';
}

export interface BudgetCheckResult {
  allowed: boolean;
  teamBudgetRemaining: number | null;   // null = no budget set
  agentBudgetRemaining: number | null;
  reason?: string;  // e.g. "Team 'cx-team' exceeded monthly budget of $500.00"
}

export interface BudgetManager {
  checkBudget(workspaceId: string, teamId: string, agentId: string, estimatedCostUsd: number): BudgetCheckResult;
  recordSpend(workspaceId: string, teamId: string, agentId: string, costUsd: number): void;
  setTeamBudget(workspaceId: string, teamId: string, monthlyBudgetUsd: number, hardCap?: boolean): void;
  setAgentBudget(workspaceId: string, agentId: string, dailyBudgetUsd: number, hardCap?: boolean): void;
  getTeamBudget(workspaceId: string, teamId: string): TeamBudget | null;
  getAgentBudget(workspaceId: string, agentId: string): AgentBudget | null;
  listTeamBudgets(workspaceId: string): TeamBudget[];
  resetDailyBudgets(workspaceId: string): void;
  resetMonthlyBudgets(workspaceId: string): void;
}
```

**實作 `SqliteBudgetManager`：**

關鍵要求（這是我們贏 LiteLLM 的地方）：
1. `checkBudget()` 必須用 `BEGIN IMMEDIATE` transaction → 確保原子性
2. `recordSpend()` 在同一個 transaction 裡更新 `currentSpendUsd`
3. 當 hardCap=true 且超過預算時，回傳 `allowed: false`
4. 當 hardCap=false（soft cap），回傳 `allowed: true` 但在 metadata 中標記 warning
5. 自動檢查 period：如果今天日期超過 periodEnd，先 reset 再 check
6. `resetDailyBudgets()` 重設所有 agent budgets 的 currentSpendUsd=0 + 更新 periodStart
7. `resetMonthlyBudgets()` 重設所有 team budgets 的 currentSpendUsd=0 + 更新 period

---

### Task 5: BudgetManager 測試

**新建檔案：`packages/domain/src/budget.test.ts`**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
// import SqliteBudgetManager, createDatabase...

describe('SqliteBudgetManager', () => {
  // beforeEach: create in-memory SQLite DB for testing

  it('should allow request within team budget', () => {
    // setTeamBudget: $100/month
    // checkBudget with $5 estimated → allowed: true
  });

  it('should deny request when team hard cap exceeded', () => {
    // setTeamBudget: $10/month, hardCap=true
    // recordSpend: $9
    // checkBudget with $5 estimated → allowed: false, reason includes "exceeded"
  });

  it('should allow request when team soft cap exceeded', () => {
    // setTeamBudget: $10/month, hardCap=false
    // recordSpend: $15
    // checkBudget → allowed: true (soft cap = warning only)
  });

  it('should deny request when agent daily hard cap exceeded', () => {
    // setAgentBudget: $5/day, hardCap=true
    // recordSpend: $4
    // checkBudget with $3 estimated → allowed: false
  });

  it('should atomically update spend on recordSpend', () => {
    // recordSpend $3 then $4 → currentSpendUsd should be $7
  });

  it('should reset daily agent budgets', () => {
    // recordSpend → currentSpend > 0
    // resetDailyBudgets → currentSpend = 0
  });

  it('should reset monthly team budgets', () => {
    // similar to above for monthly
  });

  it('should return null remaining when no budget set', () => {
    // checkBudget for team with no budget → teamBudgetRemaining: null
  });
});
```

---

### Task 6: 把 Budget Check 接入 Proxy

**修改檔案：`apps/api/src/proxy.ts`**

在 `registerProxyRoutes()` 函數簽名加入 `budgetManager` 和 `auditLogger` 參數：

```typescript
export function registerProxyRoutes(
  app: ProxyApp,
  agentRegistry?: AgentRegistry,
  budgetManager?: BudgetManager,
  auditLogger?: AuditLogger
): void {
```

在 policy check 之後、upstream request 之前加入：

```typescript
// --- Budget check (BEFORE proxying) ---
if (budgetManager) {
  const estimatedCostUsd = estimateCost(model, 500, 500); // rough estimate pre-request
  const budgetCheck = budgetManager.checkBudget(workspaceId, teamId, agentId, estimatedCostUsd);
  if (!budgetCheck.allowed) {
    if (auditLogger) {
      auditLogger.log(workspaceId, {
        eventType: 'budget.exceeded',
        actorType: 'agent',
        actorId: agentId,
        targetType: 'budget',
        targetId: teamId,
        action: 'proxy.request',
        outcome: 'denied',
        metadata: { reason: budgetCheck.reason, estimatedCostUsd },
      });
    }
    reply_.status(429).send({
      error: 'Budget exceeded',
      message: budgetCheck.reason,
      teamBudgetRemaining: budgetCheck.teamBudgetRemaining,
      agentBudgetRemaining: budgetCheck.agentBudgetRemaining,
    });
    return;
  }
}
```

在 upstream response 成功後、logStore.append() 之後加入：

```typescript
// --- Record actual spend (AFTER proxying) ---
if (budgetManager && logEntry.costUsd) {
  budgetManager.recordSpend(workspaceId, teamId, agentId, logEntry.costUsd);
}
```

同時更新 logEntry 的 `costUsd` 計算：

```typescript
import { estimateCost } from '@agent-control-tower/domain';

// 在 usage 解析後：
const costUsd = usage
  ? estimateCost(model, usage.prompt_tokens ?? 0, usage.completion_tokens ?? 0)
  : null;
```

---

### Task 7: Budget API Endpoints

**修改檔案：`apps/api/src/server.ts`**

新增以下 endpoints：

- GET /api/budgets/teams — 列出所有 team budgets
- POST /api/budgets/teams — 設定 team budget (body: teamId, monthlyBudgetUsd, hardCap?)
- GET /api/budgets/teams/:teamId — 取得特定 team budget
- POST /api/budgets/agents — 設定 agent budget (body: agentId, dailyBudgetUsd, hardCap?)
- GET /api/budgets/agents/:agentId — 取得特定 agent budget
- GET /api/costs — Cost Attribution (query: groupBy=team|agent|model|team,model, startDate?, endDate?)

**在 server.ts 初始化時建立 budgetManager 並傳入 registerProxyRoutes(app, agentRegistry, budgetManager, auditLogger)。**

---

### Task 8: Cost Dashboard 頁面

**新建檔案：`apps/web/app/costs/page.tsx`**

- Cost by Team 表格：team name, current month spend, budget, utilization bar（綠 &lt; 60%, 黃 60–80%, 紅 &gt; 80%, 閃爍紅 &gt; 100%）
- Cost by Agent 表格：agent name, today spend, daily budget, utilization bar
- Set Budget 表單：選 team/agent、金額、hard/soft cap toggle
- 純 HTML/CSS bars，不引入 charting library
- 數據：GET /api/budgets/teams, GET /api/costs?groupBy=team

---

### Task 9: 導出新模組 + 更新 layout

- `packages/domain/src/index.ts`：`export * from './budget';` 與 `export * from './cost-estimator';`
- `apps/web/app/layout.tsx`：導航列加上 "Costs" 連結

---

### Task 10: 跑測試 + Commit

```bash
pnpm turbo check test
git add -A
git commit -m "feat: per-team cost attribution + budget enforcement

- Team monthly budgets and agent daily budgets with hard caps
- Atomic budget check before proxy request (SQLite transactions)
- Token-to-cost estimation for major models
- Cost attribution API: group by team/agent/model
- Budget management API: CRUD for team and agent budgets
- Cost dashboard with budget utilization visualization
- Audit log entry on budget exceed (429 response)
- Reliable enforcement via transactional check-then-spend"
git push origin feat/cost-budgets
```

---

## 驗收標準 (Definition of Done)

- [ ] `pnpm turbo check` 無 TypeScript 錯誤
- [ ] `pnpm turbo test` 所有測試通過
- [ ] 設定 team budget $10 → 花超 → proxy 回傳 429
- [ ] 設定 agent daily budget $5 → 花超 → proxy 回傳 429
- [ ] soft cap (hardCap=false) 不阻擋但 audit log 記錄 warning
- [ ] GET /api/costs?groupBy=team 回傳正確的 cost attribution
- [ ] Web UI /costs 頁面顯示 budget utilization bars
- [ ] Budget exceed 事件出現在 /audit 頁面
- [ ] SQLite transaction 確保不會 race condition 超支

---

## 重要提醒

1. **這是打敗 LiteLLM 的關鍵功能** — budget enforcement 的可靠性是我們的核心差異化。一定要用 SQLite `BEGIN IMMEDIATE` transaction。
2. **estimateCost 在 proxy 前是預估**（用 rough 500/500 tokens），在 proxy 後用實際 usage tokens 計算真正 cost。
3. **recordSpend 必須在 logStore.append 的同一個 transaction 裡** — 確保 log 和 spend 不會不一致。
4. **不要引入任何 charting library** — dashboard 用純 CSS bars。保持 bundle 小。
