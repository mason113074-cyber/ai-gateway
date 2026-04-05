import "dotenv/config";
import path from "node:path";
import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { renderMetrics } from "./metrics.js";
import {
  evaluatePolicy,
  mockApprovals,
  mockAuditEvents,
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
  type PiiType,
} from "@agent-control-tower/domain";
import type { FastifyRequest } from "fastify";
import { registerAuthMiddleware } from "./auth-middleware.js";
import { requirePermission } from "./require-permission.js";
import { registerProxyRoutes } from "./proxy.js";

type CostGroupBy = "team" | "agent" | "model" | "team,model";

type AuthedRequest = FastifyRequest & {
  workspaceId?: string;
  userId?: string;
  permissions?: string[];
};

type FastifyLike = Parameters<typeof registerProxyRoutes>[0] & {
  addHook: (name: string, fn: (req: unknown, reply: unknown) => Promise<void>) => void;
  register: (plugin: unknown, opts?: unknown) => Promise<void>;
  get: (path: string, handlerOrOpts?: unknown, handler?: unknown) => void;
  post: (path: string, handlerOrOpts?: unknown, handler?: unknown) => void;
  patch: (path: string, handlerOrOpts?: unknown, handler?: unknown) => void;
  delete: (path: string, handlerOrOpts?: unknown, handler?: unknown) => void;
  listen: (opts: { port: number; host: string }) => Promise<string>;
  log: { error: (e: unknown) => void };
};

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

const createApp = Fastify as unknown as (opts?: { logger?: boolean }) => FastifyLike;
const app = createApp({ logger: true });
await app.register(cors, { origin: true });

registerAuthMiddleware(
  app as unknown as Parameters<typeof registerAuthMiddleware>[0],
  apiKeyManager,
  {
  auditLog: async (workspaceId, event) => {
    await auditLogger.log(workspaceId, {
      eventType: event.eventType,
      actorType:
        event.actorType === "agent" || event.actorType === "user"
          ? event.actorType
          : "system",
      actorId: event.actorId,
      action: "auth",
      outcome:
        event.outcome === "success" || event.outcome === "error"
          ? event.outcome
          : "denied",
    });
  },
  }
);

await app.register(async (proxyScope: FastifyInstance) => {
  proxyScope.addContentTypeParser(
    "application/json",
    { parseAs: "string", bodyLimit: 10485760 },
    (_req, body, done) => {
      done(null, body);
    }
  );
  registerProxyRoutes(proxyScope as Parameters<typeof registerProxyRoutes>[0], agentRegistry, logStore, budgetManager, auditLogger, {
    getPiiConfig: (workspaceId) => getPiiConfig(guardrailStore, workspaceId),
    getRateLimitConfig: (workspaceId, teamId, agentId) =>
      rateLimitConfigStore.getEffectiveConfig(workspaceId, teamId, agentId),
    rateLimiter,
  });
});

app.get("/health", async () => ({ ok: true, service: "ai-gateway-api" }));

app.get("/metrics", async (_request, reply) => {
  return reply
    .header("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
    .send(renderMetrics());
});

app.get("/api/session", async (request: AuthedRequest) => ({
  workspaceId: request.workspaceId ?? null,
  userId: request.userId ?? null,
  permissions: request.permissions ?? null,
}));

app.get(
  "/api/agents",
  { preHandler: [requirePermission("read:agents")] },
  async (request: AuthedRequest) => {
    const workspaceId = request.workspaceId ?? "default";
    return { items: await agentRegistry.list(workspaceId) };
  }
);

app.post(
  "/api/agents",
  { preHandler: [requirePermission("write:agents")] },
  async (request: AuthedRequest & { body?: unknown }) => {
    const workspaceId = request.workspaceId ?? "default";
    if (!request.body || typeof request.body !== "object") {
      throw { statusCode: 400, message: "Body required" };
    }
    return await agentRegistry.create(
      workspaceId,
      request.body as Parameters<typeof agentRegistry.create>[1]
    );
  }
);

app.patch(
  "/api/agents/:id",
  { preHandler: [requirePermission("write:agents")] },
  async (
    request: AuthedRequest & { params?: { id: string }; body?: Record<string, unknown> }
  ) => {
    const workspaceId = request.workspaceId ?? "default";
    const id = request.params?.id;
    if (!id) throw { statusCode: 400, message: "id required" };
    const agent = await agentRegistry.update(workspaceId, id, request.body ?? {});
    if (!agent) throw { statusCode: 404, message: "Agent not found" };
    return agent;
  }
);

app.get("/api/approvals", { preHandler: [requirePermission("read:audit")] }, async () => ({
  items: mockApprovals,
}));

app.get("/api/audit", { preHandler: [requirePermission("read:audit")] }, async () => ({
  items: mockAuditEvents,
}));

app.get(
  "/api/audit-logs",
  { preHandler: [requirePermission("read:audit")] },
  async (
    request: AuthedRequest & {
      query?: {
        eventType?: string;
        actorId?: string;
        startDate?: string;
        endDate?: string;
        limit?: string;
        offset?: string;
      };
    }
  ) => {
    const workspaceId = request.workspaceId ?? "default";
    const q = request.query ?? {};
    return await auditLogger.query({
      workspaceId,
      eventType: q.eventType,
      actorId: q.actorId,
      startDate: q.startDate,
      endDate: q.endDate,
      limit: q.limit ? Number(q.limit) : 100,
      offset: q.offset ? Number(q.offset) : 0,
    });
  }
);

app.get(
  "/api/guardrails",
  { preHandler: [requirePermission("read:audit")] },
  async (request: AuthedRequest) => {
    const workspaceId = request.workspaceId ?? "default";
    return { items: await guardrailStore.list(workspaceId) };
  }
);

app.post(
  "/api/guardrails",
  { preHandler: [requirePermission("write:policies")] },
  async (
    request: AuthedRequest & {
      body?: {
        type?: string;
        config?: { enabledTypes: PiiType[]; action: "redact" | "warn" | "block" };
        enabled?: boolean;
      };
    }
  ) => {
    const workspaceId = request.workspaceId ?? "default";
    const { type, config, enabled } = request.body ?? {};
    if (!type || !config) throw { statusCode: 400, message: "type and config required" };
    return await guardrailStore.upsert(workspaceId, type, config, enabled ?? true);
  }
);

app.patch(
  "/api/guardrails/:id",
  { preHandler: [requirePermission("write:policies")] },
  async (
    request: AuthedRequest & { params?: { id: string }; body?: { enabled?: boolean } }
  ) => {
    const workspaceId = request.workspaceId ?? "default";
    const id = request.params?.id;
    const enabled = request.body?.enabled;
    if (!id) throw { statusCode: 400, message: "id required" };
    if (enabled === undefined) throw { statusCode: 400, message: "enabled required" };
    const result = await guardrailStore.setEnabled(workspaceId, id, enabled);
    if (!result) throw { statusCode: 404, message: "Guardrail config not found" };
    return result;
  }
);

app.get(
  "/api/rate-limits",
  { preHandler: [requirePermission("read:rate-limits")] },
  async (request: AuthedRequest) => {
    const workspaceId = request.workspaceId ?? "default";
    return { items: rateLimitConfigStore.list(workspaceId) };
  }
);

app.post(
  "/api/rate-limits",
  { preHandler: [requirePermission("write:rate-limits")] },
  async (
    request: AuthedRequest & {
      body?: {
        targetType?: "team" | "agent" | "global";
        targetId?: string;
        requestsPerMinute?: number;
        tokensPerMinute?: number;
        burstMultiplier?: number;
      };
    }
  ) => {
    const workspaceId = request.workspaceId ?? "default";
    const { targetType, targetId, requestsPerMinute, tokensPerMinute, burstMultiplier } =
      request.body ?? {};
    if (!targetType || !targetId || requestsPerMinute == null) {
      throw { statusCode: 400, message: "targetType, targetId, and requestsPerMinute required" };
    }
    return rateLimitConfigStore.upsert(workspaceId, targetType, targetId, {
      requestsPerMinute,
      tokensPerMinute,
      burstMultiplier,
    });
  }
);

app.delete(
  "/api/rate-limits/:id",
  { preHandler: [requirePermission("write:rate-limits")] },
  async (request: AuthedRequest & { params?: { id: string } }) => {
    const workspaceId = request.workspaceId ?? "default";
    const id = request.params?.id;
    if (!id) throw { statusCode: 400, message: "id required" };
    const deleted = rateLimitConfigStore.remove(workspaceId, id);
    if (!deleted) throw { statusCode: 404, message: "Rate limit config not found" };
    return { deleted: true };
  }
);

app.get(
  "/api/rate-limits/status",
  { preHandler: [requirePermission("read:rate-limits")] },
  async (request: AuthedRequest) => {
    const workspaceId = request.workspaceId ?? "default";
    const configs = rateLimitConfigStore.list(workspaceId);
    return {
      items: configs.map((config) => {
        const key = `${config.targetType}:${config.targetId}`;
        const result = rateLimiter.check(key, {
          requestsPerMinute: config.requestsPerMinute,
          tokensPerMinute: config.tokensPerMinute ?? undefined,
          burstMultiplier: config.burstMultiplier,
        });
        const effectiveLimit =
          config.requestsPerMinute * 2 * (config.burstMultiplier || 1.5);
        const utilizationPct =
          effectiveLimit > 0
            ? Math.round((1 - result.remaining / effectiveLimit) * 100)
            : 0;
        return {
          ...config,
          currentUsage: {
            remaining: result.remaining,
            limit: result.limit,
            resetAt: result.resetAt,
            utilizationPct: Math.min(100, Math.max(0, utilizationPct)),
          },
        };
      }),
    };
  }
);

app.get(
  "/api/logs",
  { preHandler: [requirePermission("read:logs")] },
  async (request: { query?: { agentId?: string; teamId?: string; limit?: string } }) => {
    const { agentId, teamId, limit } = request.query ?? {};
    return {
      items: await logStore.list({
        agentId,
        teamId,
        limit: limit ? Number(limit) : 100,
      }),
    };
  }
);

app.get(
  "/api/stats",
  { preHandler: [requirePermission("read:costs")] },
  async (request: { query?: { agentId?: string; teamId?: string } }) => {
    const { agentId, teamId } = request.query ?? {};
    return await logStore.getStats({ agentId, teamId });
  }
);

app.get(
  "/api/budgets/teams",
  { preHandler: [requirePermission("read:costs")] },
  async (request: AuthedRequest) => {
    const workspaceId = request.workspaceId ?? "default";
    return { items: await budgetManager.listTeamBudgets(workspaceId) };
  }
);

app.post(
  "/api/budgets/teams",
  { preHandler: [requirePermission("write:budgets")] },
  async (
    request: AuthedRequest & {
      body?: { teamId?: string; monthlyBudgetUsd?: number; hardCap?: boolean };
    }
  ) => {
    const workspaceId = request.workspaceId ?? "default";
    const { teamId, monthlyBudgetUsd, hardCap } = request.body ?? {};
    if (!teamId || monthlyBudgetUsd == null) {
      throw { statusCode: 400, message: "teamId and monthlyBudgetUsd required" };
    }
    await budgetManager.setTeamBudget(
      workspaceId,
      teamId,
      Number(monthlyBudgetUsd),
      hardCap ?? true
    );
    return await budgetManager.getTeamBudget(workspaceId, teamId);
  }
);

app.get(
  "/api/budgets/teams/:teamId",
  { preHandler: [requirePermission("read:costs")] },
  async (request: AuthedRequest & { params?: { teamId: string } }) => {
    const workspaceId = request.workspaceId ?? "default";
    const teamId = request.params?.teamId;
    if (!teamId) throw { statusCode: 400, message: "teamId required" };
    const budget = await budgetManager.getTeamBudget(workspaceId, teamId);
    if (!budget) throw { statusCode: 404, message: "Budget not found" };
    return budget;
  }
);

app.post(
  "/api/budgets/agents",
  { preHandler: [requirePermission("write:budgets")] },
  async (
    request: AuthedRequest & {
      body?: { agentId?: string; dailyBudgetUsd?: number; hardCap?: boolean };
    }
  ) => {
    const workspaceId = request.workspaceId ?? "default";
    const { agentId, dailyBudgetUsd, hardCap } = request.body ?? {};
    if (!agentId || dailyBudgetUsd == null) {
      throw { statusCode: 400, message: "agentId and dailyBudgetUsd required" };
    }
    await budgetManager.setAgentBudget(
      workspaceId,
      agentId,
      Number(dailyBudgetUsd),
      hardCap ?? true
    );
    return await budgetManager.getAgentBudget(workspaceId, agentId);
  }
);

app.get(
  "/api/budgets/agents/:agentId",
  { preHandler: [requirePermission("read:costs")] },
  async (request: AuthedRequest & { params?: { agentId: string } }) => {
    const workspaceId = request.workspaceId ?? "default";
    const agentId = request.params?.agentId;
    if (!agentId) throw { statusCode: 400, message: "agentId required" };
    const budget = await budgetManager.getAgentBudget(workspaceId, agentId);
    if (!budget) throw { statusCode: 404, message: "Budget not found" };
    return budget;
  }
);

app.get(
  "/api/costs",
  { preHandler: [requirePermission("read:costs")] },
  async (
    request: AuthedRequest & {
      query?: { groupBy?: string; startDate?: string; endDate?: string };
    }
  ) => {
    const workspaceId = request.workspaceId ?? "default";
    const { groupBy, startDate, endDate } = request.query ?? {};
    const validGroupBy: CostGroupBy =
      groupBy === "team" || groupBy === "agent" || groupBy === "model" || groupBy === "team,model"
        ? groupBy
        : "team";
    const result = await queryCostAttribution(db, workspaceId, {
      groupBy: validGroupBy,
      startDate,
      endDate,
    });
    return { items: result };
  }
);

app.post(
  "/api/policy/evaluate",
  { preHandler: [requirePermission("write:policies")] },
  async (request: { body: ActionRequest }) => {
    return evaluatePolicy(request.body as ActionRequest);
  }
);

app.post(
  "/api/keys",
  { preHandler: [requirePermission("manage:keys")] },
  async (
    request: AuthedRequest & {
      body?: {
        name?: string;
        teamId?: string;
        permissions?: string[];
        allowedModels?: string[];
        rateLimit?: number;
        expiresAt?: string;
      };
    }
  ) => {
    const workspaceId = request.workspaceId ?? "default";
    const { name, teamId, permissions, allowedModels, rateLimit, expiresAt } =
      request.body ?? {};
    if (!name || !Array.isArray(permissions)) {
      throw { statusCode: 400, message: "name and permissions required" };
    }
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
  }
);

app.get(
  "/api/keys",
  { preHandler: [requirePermission("read:keys")] },
  async (request: AuthedRequest) => {
    const workspaceId = request.workspaceId ?? "default";
    return { items: apiKeyManager.list(workspaceId) };
  }
);

app.delete(
  "/api/keys/:id",
  { preHandler: [requirePermission("manage:keys")] },
  async (request: AuthedRequest & { params?: { id: string } }) => {
    const workspaceId = request.workspaceId ?? "default";
    const id = request.params?.id;
    if (!id) throw { statusCode: 400, message: "id required" };
    const deleted = apiKeyManager.revoke(workspaceId, id);
    if (!deleted) throw { statusCode: 404, message: "Key not found" };
    return { deleted: true };
  }
);

app.patch(
  "/api/keys/:id",
  { preHandler: [requirePermission("manage:keys")] },
  async (
    request: AuthedRequest & {
      params?: { id: string };
      body?: { name?: string; permissions?: string[]; allowedModels?: string[]; rateLimit?: number };
    }
  ) => {
    const workspaceId = request.workspaceId ?? "default";
    const id = request.params?.id;
    if (!id) throw { statusCode: 400, message: "id required" };
    const updated = apiKeyManager.update(workspaceId, id, request.body ?? {});
    if (!updated) throw { statusCode: 404, message: "Key not found" };
    return updated;
  }
);

const port = Number(process.env.PORT ?? 4000);
app.listen({ port, host: "0.0.0.0" }).catch((error: unknown) => {
  app.log.error(error);
  process.exit(1);
});
