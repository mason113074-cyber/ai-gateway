import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import {
  evaluatePolicy,
  InMemoryAgentRegistry,
  mockApprovals,
  mockAuditEvents,
  type ActionRequest,
  type AgentRecord,
} from "@agent-control-tower/domain";
import { registerAuthMiddleware } from "./auth-middleware.js";
import { registerProxyRoutes, getLogStore } from "./proxy.js";

const createFastify = Fastify as unknown as (opts?: { logger?: boolean }) => any;
const app = createFastify({ logger: true });

const agentRegistry = new InMemoryAgentRegistry();

await app.register(cors, { origin: true });
registerAuthMiddleware(app);
registerProxyRoutes(app, agentRegistry);

const logStore = getLogStore();

app.get("/health", async () => {
  return { ok: true, service: "ai-gateway-api" };
});

/** Session probe: returns request context from auth middleware (scaffold). */
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

app.post("/api/agents", async (request: { body?: Omit<AgentRecord, "id">; workspaceId?: string }) => {
  const workspaceId = request.workspaceId ?? "default";
  const body = request.body;
  if (!body) throw { statusCode: 400, message: "Body required" };
  const agent = agentRegistry.create(workspaceId, body);
  return agent;
});

app.patch("/api/agents/:id", async (request: { params: { id: string }; body?: Partial<Omit<AgentRecord, "id">>; workspaceId?: string }) => {
  const workspaceId = request.workspaceId ?? "default";
  const { id } = request.params;
  const body = request.body ?? {};
  const agent = agentRegistry.update(workspaceId, id, body);
  if (!agent) throw { statusCode: 404, message: "Agent not found" };
  return agent;
});

app.get("/api/approvals", async () => {
  return { items: mockApprovals };
});

app.get("/api/audit", async () => {
  return { items: mockAuditEvents };
});

app.post("/api/policy/evaluate", async (request: { body: ActionRequest }) => {
  return evaluatePolicy(request.body);
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

const port = Number(process.env.PORT ?? 4000);

app.listen({ port, host: "0.0.0.0" }).catch((error: unknown) => {
  app.log.error(error);
  process.exit(1);
});
