import Fastify from "fastify";
import cors from "@fastify/cors";
import {
  evaluatePolicy,
  mockAgents,
  mockApprovals,
  mockAuditEvents,
  type ActionRequest,
} from "@agent-control-tower/domain";

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

app.get("/health", async () => {
  return { ok: true, service: "agent-control-tower-api" };
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

app.post<{ Body: ActionRequest }>("/api/policy/evaluate", async (request) => {
  return evaluatePolicy(request.body);
});

const port = Number(process.env.PORT ?? 4000);

app.listen({ port, host: "0.0.0.0" }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
