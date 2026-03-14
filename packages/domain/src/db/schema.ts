import {
  sqliteTable,
  text,
  integer,
  real,
} from "drizzle-orm/sqlite-core";

export const proxyLogs = sqliteTable("proxy_logs", {
  id: text("id").primaryKey(),
  timestamp: text("timestamp").notNull(),
  workspaceId: text("workspace_id").notNull().default("default"),
  agentId: text("agent_id").notNull(),
  teamId: text("team_id").notNull(),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  endpoint: text("endpoint").notNull(),
  requestTokens: integer("request_tokens"),
  responseTokens: integer("response_tokens"),
  totalTokens: integer("total_tokens"),
  latencyMs: integer("latency_ms").notNull(),
  statusCode: integer("status_code").notNull(),
  costUsd: real("cost_usd"),
  error: text("error"),
});

export const agents = sqliteTable("agents", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().default("default"),
  name: text("name").notNull(),
  owner: text("owner"),
  sponsor: text("sponsor"),
  description: text("description"),
  status: text("status").notNull().default("active"),
  allowedTools: text("allowed_tools"),
  allowedDataScopes: text("allowed_data_scopes"),
  autoRegistered: integer("auto_registered").notNull().default(0),
  createdAt: text("created_at").notNull(),
  lastSeenAt: text("last_seen_at"),
});

export const auditLogs = sqliteTable("audit_logs", {
  id: text("id").primaryKey(),
  timestamp: text("timestamp").notNull(),
  workspaceId: text("workspace_id").notNull().default("default"),
  eventType: text("event_type").notNull(),
  actorType: text("actor_type").notNull(),
  actorId: text("actor_id").notNull(),
  targetType: text("target_type"),
  targetId: text("target_id"),
  action: text("action").notNull(),
  outcome: text("outcome").notNull(),
  metadata: text("metadata"),
});

export const teamBudgets = sqliteTable("team_budgets", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  teamId: text("team_id").notNull(),
  monthlyBudgetUsd: real("monthly_budget_usd").notNull(),
  currentSpendUsd: real("current_spend_usd").notNull().default(0),
  periodStart: text("period_start").notNull(),
  periodEnd: text("period_end").notNull(),
  hardCap: integer("hard_cap").notNull().default(1),
  alertThresholdPct: integer("alert_threshold_pct").notNull().default(80),
  status: text("status").notNull().default("active"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const agentBudgets = sqliteTable("agent_budgets", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  agentId: text("agent_id").notNull(),
  dailyBudgetUsd: real("daily_budget_usd").notNull(),
  currentSpendUsd: real("current_spend_usd").notNull().default(0),
  periodStart: text("period_start").notNull(),
  hardCap: integer("hard_cap").notNull().default(1),
  status: text("status").notNull().default("active"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  email: text("email").notNull(),
  name: text("name"),
  role: text("role").notNull().default("viewer"),
  createdAt: text("created_at").notNull(),
  lastLoginAt: text("last_login_at"),
});

export const apiKeys = sqliteTable("api_keys", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  userId: text("user_id"),
  teamId: text("team_id"),
  name: text("name").notNull(),
  keyHash: text("key_hash").notNull(),
  keyPrefix: text("key_prefix").notNull(),
  permissions: text("permissions").notNull(),
  allowedModels: text("allowed_models"),
  rateLimit: integer("rate_limit"),
  expiresAt: text("expires_at"),
  lastUsedAt: text("last_used_at"),
  createdAt: text("created_at").notNull(),
});

// ── Phase 8: Guardrail Configs ───────────────────────────────
export const guardrailConfigs = sqliteTable("guardrail_configs", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  type: text("type").notNull(), // 'pii_redaction' | 'prompt_injection' | 'content_filter'
  config: text("config").notNull(), // JSON configuration
  enabled: integer("enabled").notNull().default(1),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
