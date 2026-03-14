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
  allowedTools: text("allowed_tools"), // JSON array
  allowedDataScopes: text("allowed_data_scopes"), // JSON array
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
  metadata: text("metadata"), // JSON
});
