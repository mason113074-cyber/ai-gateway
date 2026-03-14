import "dotenv/config";
import path from "node:path";
import Fastify from "fastify";
import cors from "@fastify/cors";
import {
  evaluatePolicy,
  mockApprovals,
  mockAuditEvents,
  createDatabaseWithRaw,
  createSqliteLogStore,
  createSqliteAgentRegistry,
  createSqliteAuditLogger,
  createSqliteBudgetManager,
  createSqliteApiKeyManager,
  createSqliteGuardrailStore,
  getPiiConfig,
  queryCostAttribution,
  type ActionRequest,
} from "@agent-control-tower/domain";
import { registerAuthMiddleware } from "./auth-middleware.js";
import { requirePermission } from "./require-permission.js";
import { registerProxyRoutes } from "./proxy.js";

const dbPath = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "gateway.db");
const { db, raw } = createDatabaseWithRaw(dbPath);
const logStore = createSqliteLogStore(db);
const agentRegistry = createSqliteAgentRegistry(db);
const auditLogger = createSqliteAuditLogger(db);
const budgetManager = createSqliteBudgetManager(db, raw);
const apiKeyManager = createSqliteApiKeyManager(raw);
const guardrailStore = createSqliteGuardrailStore(db);

const createApp = Fastify as unknown as (opts?: { logger?: boolean }) => Parameters<typeof registerProxyRoutes>[0] & {
  register: (plugin: unknown, opts?: unknown) => Promise<void>;
  get: (path: string, handlerOrOpts?: unknown, handler?: unknown) => void;
  post: (path: string, handlerOrOpts?: unknown, handler?: unknown) => void;
  patch: (path: string, handlerOrOpts?: unknown, handler?: unknown) => void;
  delete: (path: string, handlerOrOpts?: unknown, handler?: unknown) => void;
  listen: (opts: { port: number; host: string }) => Promise<string>;
  log: { error: (e: unknown) => void };
  addHook: (name: string, fn: (req: unknown, reply: unknown) => Promise<void>) => void;
};
const app = createApp({ logger: true });
await app.register(cors, { origin: true });

registerAuthMiddleware(app as Parameters<typeof registerAuthMiddleware>[0], apiKeyManager, {
  auditLog: (workspaceId, event) =>
    auditLogger.log(workspaceId, {
      eventType: event.eventType,
      actorType: (event.actorType === "agent" || event.actorType === "user" ? event.actorType : "system") as "agent" | "user" | "system",
      actorId: event.actorId,
      action: "auth",
      outcome: (event.outcome === "success" || event.outcome === "error" ? event.outcome : "denied") as "denied" | "error" | "success",
    }),
});
registerProxyRoutes(app, agentRegistry, logStore, budgetManager, auditLogger, {
  getPiiConfig: (workspaceId) => getPiiConfig(guardrailStore, workspaceId),
});

app.get("/health", async () => {
  return { ok: true, service: "ai-gateway-api" };
});

app.get("/api/session", async (request: { workspaceId?: string; userId?: string; permissions?: string[] }) => {
  return {
    workspaceId: request.workspaceId ?? null,
    userId: request.userId ?? null,
    permissions: request.permissions ?? null,
  };
});

app.get("/api/agents", { preHandler: [requirePermission("read:logs")] }, async (request: { workspaceId?: string }) => {
  const workspaceId = request.workspaceId ?? "default";
  return { items: agentRegistry.list(workspaceId) };
});

app.post("/api/agents", { preHandler: [requirePermission("write:agents")] }, async (request: { workspaceId?: string; body?: unknown }) => {
  const workspaceId = request.workspaceId ?? "default";
  const body = request.body;
  if (!body || typeof body !== "object") throw { statusCode: 400, message: "Body required" };
  const agent = agentRegistry.create(workspaceId, body as Parameters<typeof agentRegistry.create>[1]);
  return agent;
});

app.patch("/api/agents/:id", { preHandler: [requirePermission("write:agents")] }, async (request: { workspaceId?: string; params?: { id: string }; body?: unknown }) => {
  const workspaceId = request.workspaceId ?? "default";
  const { id } = request.params ?? {};
  const body = (request.body ?? {}) as Record<string, unknown>;
  if (!id) throw { statusCode: 400, message: "id required" };
  const agent = agentRegistry.update(workspaceId, id, body as Partial<Parameters<typeof agentRegistry.update>[2]>);
  if (!agent) throw { statusCode: 404, message: "Agent not found" };
  return agent;
});

app.get("/api/approvals", { preHandler: [requirePermission("read:audit")] }, async () => {
  return { items: mockApprovals };
});

app.get("/api/audit", { preHandler: [requirePermission("read:audit")] }, async () => {
  return { items: mockAuditEvents };
});

app.get("/api/audit-logs", { preHandler: [requirePermission("read:audit")] }, async (request: {
  workspaceId?: string;
  query?: { eventType?: string; actorId?: string; startDate?: string; endDate?: string; limit?: string; offset?: string };
}) => {
  const workspaceId = request.workspaceId ?? "default";
  const q = request.query ?? {};
  const result = auditLogger.query({
    workspaceId,
    eventType: q.eventType,
    actorId: q.actorId,
    startDate: q.startDate,
    endDate: q.endDate,
    limit: q.limit ? Number(q.limit) : 100,
    offset: q.offset ? Number(q.offset) : 0,
  });
  return result;
});

app.get("/api/guardrails", { preHandler: [requirePermission("read:audit")] }, async (request: { workspaceId?: string }) => {
  const workspaceId = request.workspaceId ?? "default";
  return { items: guardrailStore.list(workspaceId) };
});

app.post("/api/guardrails", { preHandler: [requirePermission("write:policies")] }, async (request: {
  workspaceId?: string;
  body?: { type: string; config: { enabledTypes: string[]; action: string }; enabled?: boolean };
}) => {
  const workspaceId = request.workspaceId ?? "default";
  const { type, config, enabled } = request.body ?? {};
  if (!type || !config) throw { statusCode: 400, message: "type and config required" };
  const result = guardrailStore.upsert(workspaceId, type, config as Parameters<typeof guardrailStore.upsert>[2], enabled ?? true);
  return result;
});

app.patch("/api/guardrails/:id", { preHandler: [requirePermission("write:policies")] }, async (request: {
  workspaceId?: string;
  params?: { id: string };
  body?: { enabled?: boolean };
}) => {
  const workspaceId = request.workspaceId ?? "default";
  const { id } = request.params ?? {};
  const { enabled } = request.body ?? {};
  if (!id) throw { statusCode: 400, message: "id required" };
  if (enabled === undefined) throw { statusCode: 400, message: "enabled required" };
  const result = guardrailStore.setEnabled(workspaceId, id, enabled);
  if (!result) throw { statusCode: 404, message: "Guardrail config not found" };
  return result;
});

app.get("/api/logs", { preHandler: [requirePermission("read:logs")] }, async (request: { query?: { agentId?: string; teamId?: string; limit?: string } }) => {
  const { agentId, teamId, limit } = request.query ?? {};
  return {
    items: logStore.list({
      agentId,
      teamId,
      limit: limit ? Number(limit) : 100,
    }),
  };
});

app.get("/api/stats", { preHandler: [requirePermission("read:costs")] }, async (request: { query?: { agentId?: string; teamId?: string } }) => {
  const { agentId, teamId } = request.query ?? {};
  return logStore.getStats({ agentId, teamId });
});

app.get("/api/budgets/teams", { preHandler: [requirePermission("read:costs")] }, async (request: { workspaceId?: string }) => {
  const workspaceId = request.workspaceId ?? "default";
  return { items: budgetManager.listTeamBudgets(workspaceId) };
});

app.post("/api/budgets/teams", { preHandler: [requirePermission("write:budgets")] }, async (request: { workspaceId?: string; body?: { teamId?: string; monthlyBudgetUsd?: number; hardCap?: boolean } }) => {
  const workspaceId = request.workspaceId ?? "default";
  const { teamId, monthlyBudgetUsd, hardCap } = request.body ?? {};
  if (!teamId || monthlyBudgetUsd == null) throw { statusCode: 400, message: "teamId and monthlyBudgetUsd required" };
  budgetManager.setTeamBudget(workspaceId, teamId, Number(monthlyBudgetUsd), hardCap ?? true);
  return budgetManager.getTeamBudget(workspaceId, teamId);
});

app.get("/api/budgets/teams/:teamId", { preHandler: [requirePermission("read:costs")] }, async (request: { workspaceId?: string; params?: { teamId: string } }) => {
  const workspaceId = request.workspaceId ?? "default";
  const teamId = request.params?.teamId;
  if (!teamId) throw { statusCode: 400, message: "teamId required" };
  const budget = budgetManager.getTeamBudget(workspaceId, teamId);
  if (!budget) throw { statusCode: 404, message: "Budget not found" };
  return budget;
});

app.post("/api/budgets/agents", { preHandler: [requirePermission("write:budgets")] }, async (request: { workspaceId?: string; body?: { agentId?: string; dailyBudgetUsd?: number; hardCap?: boolean } }) => {
  const workspaceId = request.workspaceId ?? "default";
  const { agentId, dailyBudgetUsd, hardCap } = request.body ?? {};
  if (!agentId || dailyBudgetUsd == null) throw { statusCode: 400, message: "agentId and dailyBudgetUsd required" };
  budgetManager.setAgentBudget(workspaceId, agentId, Number(dailyBudgetUsd), hardCap ?? true);
  return budgetManager.getAgentBudget(workspaceId, agentId);
});

app.get("/api/budgets/agents/:agentId", { preHandler: [requirePermission("read:costs")] }, async (request: { workspaceId?: string; params?: { agentId: string } }) => {
  const workspaceId = request.workspaceId ?? "default";
  const agentId = request.params?.agentId;
  if (!agentId) throw { statusCode: 400, message: "agentId required" };
  const budget = budgetManager.getAgentBudget(workspaceId, agentId);
  if (!budget) throw { statusCode: 404, message: "Budget not found" };
  return budget;
});

app.get("/api/costs", { preHandler: [requirePermission("read:costs")] }, async (request: { workspaceId?: string; query?: { groupBy?: string; startDate?: string; endDate?: string } }) => {
  const workspaceId = request.workspaceId ?? "default";
  const { groupBy, startDate, endDate } = request.query ?? {};
  const validGroupBy = groupBy === "team" || groupBy === "agent" || groupBy === "model" || groupBy === "team,model" ? groupBy : "team";
  return { items: queryCostAttribution(db, workspaceId, { groupBy: validGroupBy, startDate, endDate }) };
});

app.post("/api/policy/evaluate", { preHandler: [requirePermission("write:policies")] }, async (request: { body: ActionRequest }) => {
  return evaluatePolicy(request.body);
});

app.post("/api/keys", { preHandler: [requirePermission("manage:keys")] }, async (request: {
  workspaceId?: string;
  userId?: string;
  body?: { name?: string; teamId?: string; permissions?: string[]; allowedModels?: string[]; rateLimit?: number; expiresAt?: string };
}) => {
  const workspaceId = request.workspaceId ?? "default";
  const body = (request.body ?? {}) as {
    name?: string;
    teamId?: string;
    permissions?: string[];
    allowedModels?: string[];
    rateLimit?: number;
    expiresAt?: string;
  };
  const { name, teamId, permissions, allowedModels, rateLimit, expiresAt } = body;
  if (!name || !Array.isArray(permissions)) throw { statusCode: 400, message: "name and permissions required" };
  const result = apiKeyManager.create(workspaceId, {
    name,
    userId: request.userId,
    teamId,
    permissions,
    allowedModels,
    rateLimit,
    expiresAt,
  });
  return { ...result.record, rawKey: result.rawKey };
});

app.get("/api/keys", { preHandler: [requirePermission("manage:keys")] }, async (request: { workspaceId?: string }) => {
  const workspaceId = request.workspaceId ?? "default";
  return { items: apiKeyManager.list(workspaceId) };
});

app.delete("/api/keys/:id", { preHandler: [requirePermission("manage:keys")] }, async (request: { workspaceId?: string; params?: { id: string } }) => {
  const workspaceId = request.workspaceId ?? "default";
  const id = request.params?.id;
  if (!id) throw { statusCode: 400, message: "id required" };
  const deleted = apiKeyManager.revoke(workspaceId, id);
  if (!deleted) throw { statusCode: 404, message: "Key not found" };
  return { deleted: true };
});

app.patch("/api/keys/:id", { preHandler: [requirePermission("manage:keys")] }, async (request: {
  workspaceId?: string;
  params?: { id: string };
  body?: { name?: string; permissions?: string[]; allowedModels?: string[]; rateLimit?: number };
}) => {
  const workspaceId = request.workspaceId ?? "default";
  const id = request.params?.id;
  if (!id) throw { statusCode: 400, message: "id required" };
  const updated = apiKeyManager.update(workspaceId, id, request.body ?? {});
  if (!updated) throw { statusCode: 404, message: "Key not found" };
  return updated;
});

const port = Number(process.env.PORT ?? 4000);
app.listen({ port, host: "0.0.0.0" }).catch((error: unknown) => {
  app.log.error(error);
  process.exit(1);
});
