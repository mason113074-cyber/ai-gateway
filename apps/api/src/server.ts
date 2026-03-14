import path from "node:path";
import Fastify from "fastify";
import cors from "@fastify/cors";
import {
  evaluatePolicy,
  mockApprovals,
  mockAuditEvents,
  createDatabase,
  createSqliteLogStore,
  createSqliteAgentRegistry,
  createSqliteAuditLogger,
  type ActionRequest,
} from "@agent-control-tower/domain";
import { registerAuthMiddleware } from "./auth-middleware.js";
import { registerProxyRoutes } from "./proxy.js";

const dbPath = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "gateway.db");
const db = createDatabase(dbPath);
const logStore = createSqliteLogStore(db);
const agentRegistry = createSqliteAgentRegistry(db);
const auditLogger = createSqliteAuditLogger(db);

const createApp = Fastify as unknown as (opts?: { logger?: boolean }) => Parameters<typeof registerProxyRoutes>[0] & {
  register: (plugin: unknown, opts?: unknown) => Promise<void>;
  get: (path: string, handler: unknown) => void;
  post: (path: string, handler: unknown) => void;
  patch: (path: string, handler: unknown) => void;
  listen: (opts: { port: number; host: string }) => Promise<string>;
  log: { error: (e: unknown) => void };
  addHook: (name: string, fn: (req: unknown, reply: unknown) => Promise<void>) => void;
};
const app = createApp({ logger: true });
await app.register(cors, { origin: true });
registerAuthMiddleware(app as Parameters<typeof registerAuthMiddleware>[0]);
registerProxyRoutes(app, agentRegistry, logStore, auditLogger);

app.get("/health", async () => {
  return { ok: true, service: "ai-gateway-api" };
});

app.get("/api/session", async (request: { workspaceId?: string; userId?: string }) => {
  return {
    workspaceId: request.workspaceId ?? null,
    userId: request.userId ?? null,
  };
});

app.get("/api/agents", async (request: { workspaceId?: string }) => {
  const workspaceId = request.workspaceId ?? "default";
  return { items: agentRegistry.list(workspaceId) };
});

app.post("/api/agents", async (request: { workspaceId?: string; body?: unknown }) => {
  const workspaceId = request.workspaceId ?? "default";
  const body = request.body;
  if (!body || typeof body !== "object") throw { statusCode: 400, message: "Body required" };
  const agent = agentRegistry.create(workspaceId, body as Parameters<typeof agentRegistry.create>[1]);
  return agent;
});

app.patch("/api/agents/:id", async (request: { workspaceId?: string; params?: { id: string }; body?: unknown }) => {
  const workspaceId = request.workspaceId ?? "default";
  const { id } = request.params ?? {};
  const body = (request.body ?? {}) as Record<string, unknown>;
  if (!id) throw { statusCode: 400, message: "id required" };
  const agent = agentRegistry.update(workspaceId, id, body as Partial<Parameters<typeof agentRegistry.update>[2]>);
  if (!agent) throw { statusCode: 404, message: "Agent not found" };
  return agent;
});

app.get("/api/approvals", async () => {
  return { items: mockApprovals };
});

app.get("/api/audit", async () => {
  return { items: mockAuditEvents };
});

app.get("/api/audit-logs", async (request: {
  workspaceId?: string;
  query?: {
    eventType?: string;
    actorId?: string;
    startDate?: string;
    endDate?: string;
    limit?: string;
    offset?: string;
  };
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

app.get("/api/logs", async (request: { query?: { agentId?: string; teamId?: string; limit?: string } }) => {
  const { agentId, teamId, limit } = request.query ?? {};
  return {
    items: logStore.list({
      agentId,
      teamId,
      limit: limit ? Number(limit) : 100,
    }),
  };
});

app.get("/api/stats", async (request: { query?: { agentId?: string; teamId?: string } }) => {
  const { agentId, teamId } = request.query ?? {};
  return logStore.getStats({ agentId, teamId });
});

app.post("/api/policy/evaluate", async (request: { body: ActionRequest }) => {
  return evaluatePolicy(request.body);
});

const port = Number(process.env.PORT ?? 4000);
app.listen({ port, host: "0.0.0.0" }).catch((error: unknown) => {
  app.log.error(error);
  process.exit(1);
});
