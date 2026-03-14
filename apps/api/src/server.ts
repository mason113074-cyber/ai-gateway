import "dotenv/config";
import path from "node:path";
import Fastify from "fastify";
import cors from "@fastify/cors";
import {
  evaluatePolicy,
  InMemoryAgentRegistry,
  mockApprovals,
  mockAuditEvents,
  createDatabaseWithRaw,
  createSqliteApiKeyManager,
  type ActionRequest,
  type AgentRecord,
} from "@agent-control-tower/domain";
import { registerAuthMiddleware } from "./auth-middleware.js";
import { requirePermission } from "./require-permission.js";
import { registerProxyRoutes, getLogStore } from "./proxy.js";

const dbPath = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "gateway.db");
const { raw } = createDatabaseWithRaw(dbPath);
const apiKeyManager = createSqliteApiKeyManager(raw);

const createFastify = Fastify as unknown as (opts?: { logger?: boolean }) => any;
const app = createFastify({ logger: true });

const agentRegistry = new InMemoryAgentRegistry();

await app.register(cors, { origin: true });
registerAuthMiddleware(app, apiKeyManager);
registerProxyRoutes(app, agentRegistry, undefined);

const logStore = getLogStore();

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

app.get("/api/agents", {
  preHandler: [requirePermission("read:logs")],
}, async (request: { workspaceId?: string }) => {
  const workspaceId = request.workspaceId ?? "default";
  return { items: agentRegistry.list(workspaceId) };
});

app.post("/api/agents", {
  preHandler: [requirePermission("write:agents")],
}, async (request: { body?: Omit<AgentRecord, "id">; workspaceId?: string }) => {
  const workspaceId = request.workspaceId ?? "default";
  const body = request.body;
  if (!body) throw { statusCode: 400, message: "Body required" };
  const agent = agentRegistry.create(workspaceId, body);
  return agent;
});

app.patch("/api/agents/:id", {
  preHandler: [requirePermission("write:agents")],
}, async (request: { params: { id: string }; body?: Partial<Omit<AgentRecord, "id">>; workspaceId?: string }) => {
  const workspaceId = request.workspaceId ?? "default";
  const { id } = request.params;
  const body = request.body ?? {};
  const agent = agentRegistry.update(workspaceId, id, body);
  if (!agent) throw { statusCode: 404, message: "Agent not found" };
  return agent;
});

app.get("/api/approvals", {
  preHandler: [requirePermission("read:audit")],
}, async () => {
  return { items: mockApprovals };
});

app.get("/api/audit", {
  preHandler: [requirePermission("read:audit")],
}, async () => {
  return { items: mockAuditEvents };
});

app.post("/api/policy/evaluate", {
  preHandler: [requirePermission("write:policies")],
}, async (request: { body: ActionRequest }) => {
  return evaluatePolicy(request.body);
});

app.get("/api/logs", {
  preHandler: [requirePermission("read:logs")],
}, async (request: { query?: { agentId?: string; teamId?: string; limit?: string } }) => {
  const { agentId, teamId, limit } = request.query ?? {};
  return {
    items: logStore.list({
      agentId,
      teamId,
      limit: limit ? Number(limit) : 100,
    }),
  };
});

app.get("/api/stats", {
  preHandler: [requirePermission("read:costs")],
}, async (request: { query?: { agentId?: string; teamId?: string } }) => {
  const { agentId, teamId } = request.query ?? {};
  return logStore.getStats({ agentId, teamId });
});

app.post("/api/keys", {
  preHandler: [requirePermission("manage:keys")],
}, async (request: {
  workspaceId?: string;
  userId?: string;
  body?: {
    name: string;
    teamId?: string;
    permissions: string[];
    allowedModels?: string[];
    rateLimit?: number;
    expiresAt?: string;
  };
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

app.get("/api/keys", {
  preHandler: [requirePermission("manage:keys")],
}, async (request: { workspaceId?: string }) => {
  const workspaceId = request.workspaceId ?? "default";
  return { items: apiKeyManager.list(workspaceId) };
});

app.delete("/api/keys/:id", {
  preHandler: [requirePermission("manage:keys")],
}, async (request: { workspaceId?: string; params: { id: string } }) => {
  const workspaceId = request.workspaceId ?? "default";
  const { id } = request.params;
  const deleted = apiKeyManager.revoke(workspaceId, id);
  if (!deleted) throw { statusCode: 404, message: "Key not found" };
  return { deleted: true };
});

app.patch("/api/keys/:id", {
  preHandler: [requirePermission("manage:keys")],
}, async (request: {
  workspaceId?: string;
  params: { id: string };
  body?: { name?: string; permissions?: string[]; allowedModels?: string[]; rateLimit?: number };
}) => {
  const workspaceId = request.workspaceId ?? "default";
  const { id } = request.params;
  const updated = apiKeyManager.update(workspaceId, id, request.body ?? {});
  if (!updated) throw { statusCode: 404, message: "Key not found" };
  return updated;
});

const port = Number(process.env.PORT ?? 4000);

app.listen({ port, host: "0.0.0.0" }).catch((error: unknown) => {
  app.log.error(error);
  process.exit(1);
});
