import "dotenv/config";
import path from "node:path";
import Fastify from "fastify";
import cors from "@fastify/cors";
import {
  evaluatePolicy,
  mockApprovals,
  mockAuditEvents,
  createDatabase,
  createDatabaseWithRaw,
  createLogStore,
  createAgentRegistry,
  createAuditLogger,
  createBudgetManager,
  createSqliteApiKeyManager,
  createGuardrailStore,
  getPiiConfig,
  createSlidingWindowRateLimiter,
  createSqliteRateLimitConfigStore,
  queryCostAttribution,
  type ActionRequest,
} from "@agent-control-tower/domain";
import { registerAuthMiddleware } from "./auth-middleware.js";
import { requirePermission } from "./require-permission.js";
import { registerProxyRoutes } from "./proxy.js";

const dbPath = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "gateway.db");
const { db, raw } = createDatabaseWithRaw(dbPath);
const logStore = createLogStore(db);
const agentRegistry = createAgentRegistry(db);
const auditLogger = createAuditLogger(db);
const budgetManager = createBudgetManager(db, raw);
const apiKeyManager = createSqliteApiKeyManager(raw);
const guardrailStore = createGuardrailStore(db);
const rateLimiter = createSlidingWindowRateLimiter(raw);
const rateLimitConfigStore = createSqliteRateLimitConfigStore(raw);

setInterval(() => rateLimiter.cleanup(), 5 * 60 * 1000);

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
  auditLog: async (workspaceId, event) =>
    await auditLogger.log(workspaceId, {
      eventType: event.eventType,
      actorType: (event.actorType === "agent" || event.actorType === "user" ? event.actorType : "system") as "agent" | "user" | "system",
      actorId: event.actorId,
      action: "auth",
      outcome: (event.outcome === "success" || event.outcome === "error" ? event.outcome : "denied") as "denied" | "error" | "success",
    }),
});
registerProxyRoutes(app, agentRegistry, logStore, budgetManager, auditLogger, {
  getPiiConfig: async (workspaceId) => await getPiiConfig(guardrailStore, workspaceId),
  getRateLimitConfig: (workspaceId, teamId, agentId) =>
    rateLimitConfigStore.getEffectiveConfig(workspaceId, teamId, agentId),
  rateLimiter,
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
  return { items: await agentRegistry.list(workspaceId) };
});

app.post("/api/agents", { preHandler: [requirePermission("write:agents")] }, async (request: { workspaceId?: string; body?: unknown }) => {
  const workspaceId = request.workspaceId ?? "default";
  const body = request.body;
  if (!body || typeof body !== "object") throw { statusCode: 400, message: "Body required" };
  const agent = await agentRegistry.create(workspaceId, body as any);
  return agent;
});

app.patch("/api/agents/:id", { preHandler: [requirePermission("write:agents")] }, async (request: { workspaceId?: string; params?: { id: string }; body?: unknown }) => {
  const workspaceId = request.workspaceId ?? "default";
  const { id } = request.params ?? {};
  const body = (request.body ?? {}) as Record<string, unknown>;
  if (!id) throw { statusCode: 400, message: "id required" };
  const agent = await agentRegistry.update(workspaceId, id, body as any);
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
  const result = await auditLogger.query({
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
  return { items: await guardrailStore.list(workspaceId) };
});

app.post("/api/guardrails", { preHandler: [requirePermission("write:policies")] }, async (request: {
  workspaceId?: string;
  body?: { type: string; config: { enabledTypes: string[]; action: string }; enabled?: boolean };
}) => {
  const workspaceId = request.workspaceId ?? "default";
  const { type, config, enabled } = request.body ?? {};
  if (!type || !config) throw { statusCode: 400, message: "type and config required" };
  const result = await guardrailStore.upsert(workspaceId, type, config as any, enabled ?? true);
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
  const result = await guardrailStore.setEnabled(workspaceId, id, enabled);
  if (!result) throw { statusCode: 404, message: "Guardrail config not found" };
  return result;
});

app.get("/api/rate-limits", { preHandler: [requirePermission("read:costs")] }, async (request: { workspaceId?: string }) => {
  const workspaceId = request.workspaceId ?? "default";
  return { items: rateLimitConfigStore.list(workspaceId) };
});

app.post("/api/rate-limits", { preHandler: [requirePermission("write:budgets")] }, async (request: {
  workspaceId?: string;
  body?: {
    targetType: "team" | "agent" | "global";
    targetId: string;
    requestsPerMinute: number;
    tokensPerMinute?: number;
    burstMultiplier?: number;
  };
}) => {
  const workspaceId = request.workspaceId ?? "default";
  const { targetType, targetId, requestsPerMinute, tokensPerMinute, burstMultiplier } = request.body ?? {};
  if (!targetType || !targetId || requestsPerMinute == null) {
    throw { statusCode: 400, message: "targetType, targetId, and requestsPerMinute required" };
  }
  return rateLimitConfigStore.upsert(workspaceId, targetType, targetId, {
    requestsPerMinute,
    tokensPerMinute,
    burstMultiplier,
  });
});

app.delete("/api/rate-limits/:id", { preHandler: [requirePermission("write:budgets")] }, async (request: {
  workspaceId?: string;
  params?: { id: string };
}) => {
  const workspaceId = request.workspaceId ?? "default";
  const id = request.params?.id;
  if (!id) throw { statusCode: 400, message: "id required" };
  const deleted = rateLimitConfigStore.remove(workspaceId, id);
  if (!deleted) throw { statusCode: 404, message: "Rate limit config not found" };
  return { deleted: true };
});

app.get("/api/rate-limits/status", { preHandler: [requirePermission("read:costs")] }, async (request: { workspaceId?: string }) => {
  const workspaceId = request.workspaceId ?? "default";
  const configs = rateLimitConfigStore.list(workspaceId);
  type ConfigItem = (typeof configs)[number];
  const burst = (c: ConfigItem) => c.burstMultiplier || 1.5;
  return {
    items: configs.map((c: ConfigItem) => {
      const key = `${c.targetType}:${c.targetId}`;
      const result = rateLimiter.check(key, {
        requestsPerMinute: c.requestsPerMinute,
        tokensPerMinute: c.tokensPerMinute ?? undefined,
        burstMultiplier: c.burstMultiplier,
      });
      const effectiveLimit = c.requestsPerMinute * 2 * burst(c);
      const utilizationPct = effectiveLimit > 0
        ? Math.round((1 - result.remaining / effectiveLimit) * 100)
        : 0;
      return {
        ...c,
        currentUsage: {
          remaining: result.remaining,
          limit: result.limit,
          resetAt: result.resetAt,
          utilizationPct: Math.min(100, Math.max(0, utilizationPct)),
        },
      };
    }),
  };
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
  return await logStore.getStats({ agentId, teamId });
});

app.get("/api/budgets/teams", { preHandler: [requirePermission("read:costs")] }, async (request: { workspaceId?: string }) => {
  const workspaceId = request.workspaceId ?? "default";
  return { items: await budgetManager.listTeamBudgets(workspaceId) };
});

app.post("/api/budgets/teams", { preHandler: [requirePermission("write:budgets")] }, async (request: { workspaceId?: string; body?: { teamId?: string; monthlyBudgetUsd?: number; hardCap?: boolean } }) => {
  const workspaceId = request.workspaceId ?? "default";
  const { teamId, monthlyBudgetUsd, hardCap } = request.body ?? {};
  if (!teamId || monthlyBudgetUsd == null) throw { statusCode: 400, message: "teamId and monthlyBudgetUsd required" };
  await budgetManager.setTeamBudget(workspaceId, teamId, Number(monthlyBudgetUsd), hardCap ?? true);
  return await budgetManager.getTeamBudget(workspaceId, teamId);
});

app.get("/api/budgets/teams/:teamId", { preHandler: [requirePermission("read:costs")] }, async (request: { workspaceId?: string; params?: { teamId: string } }) => {
  const workspaceId = request.workspaceId ?? "default";
  const teamId = request.params?.teamId;
  if (!teamId) throw { statusCode: 400, message: "teamId required" };
  const budget = await budgetManager.getTeamBudget(workspaceId, teamId);
  if (!budget) throw { statusCode: 404, message: "Budget not found" };
  return budget;
});

app.post("/api/budgets/agents", { preHandler: [requirePermission("write:budgets")] }, async (request: { workspaceId?: string; body?: { agentId?: string; dailyBudgetUsd?: number; hardCap?: boolean } }) => {
  const workspaceId = request.workspaceId ?? "default";
  const { agentId, dailyBudgetUsd, hardCap } = request.body ?? {};
  if (!agentId || dailyBudgetUsd == null) throw { statusCode: 400, message: "agentId and dailyBudgetUsd required" };
  await budgetManager.setAgentBudget(workspaceId, agentId, Number(dailyBudgetUsd), hardCap ?? true);
  return await budgetManager.getAgentBudget(workspaceId, agentId);
});

app.get("/api/budgets/agents/:agentId", { preHandler: [requirePermission("read:costs")] }, async (request: { workspaceId?: string; params?: { agentId: string } }) => {
  const workspaceId = request.workspaceId ?? "default";
  const agentId = request.params?.agentId;
  if (!agentId) throw { statusCode: 400, message: "agentId required" };
  const budget = await budgetManager.getAgentBudget(workspaceId, agentId);
  if (!budget) throw { statusCode: 404, message: "Budget not found" };
  return budget;
});

app.get("/api/costs", { preHandler: [requirePermission("read:costs")] }, async (request: { workspaceId?: string; query?: { groupBy?: string; startDate?: string; endDate?: string } }) => {
  const workspaceId = request.workspaceId ?? "default";
  const { groupBy, startDate, endDate } = request.query ?? {};
  const result = await queryCostAttribution(db, workspaceId, {
    groupBy: (groupBy as any) ?? "team",
    startDate,
    endDate,
  });
  return { items: result };
});Attribution(db, workspaceId, { groupBy: validGroupBy, startDate, endDate }) };
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
