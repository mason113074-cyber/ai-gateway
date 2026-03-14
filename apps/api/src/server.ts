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

const createFastify = Fastify as unknown as (opts?: { logger?: boolean }) => any;
const app = createFastify({ logger: true });

await app.register(cors, { origin: true });
registerAuthMiddleware(app);

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

const port = Number(process.env.PORT ?? 4000);

app.listen({ port, host: "0.0.0.0" }).catch((error: unknown) => {
  app.log.error(error);
  process.exit(1);
});
