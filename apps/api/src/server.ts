import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import {
  evaluatePolicy,
  mockAgents,
  mockApprovals,
  mockAuditEvents,
  type ActionRequest,
} from "@agent-control-tower/domain";
import { registerAuthMiddleware } from "./auth-middleware.js";
import { registerProxyRoutes, getLogStore } from "./proxy.js";

const createFastify = Fastify as unknown as (opts?: { logger?: boolean }) => any;
const app = createFastify({ logger: true });

await app.register(cors, { origin: true });
registerAuthMiddleware(app);
registerProxyRoutes(app);

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

app.get("/api/agents", async () => {
  return { items: mockAgents };
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
