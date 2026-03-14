import { describe, expect, it } from "vitest";
import Fastify from "fastify";
import { registerAuthMiddleware } from "./auth-middleware.js";
import { registerProxyRoutes } from "./proxy.js";
import {
  InMemoryAgentRegistry,
  InMemoryLogStore,
  type BudgetManager,
  type AuditLogger,
} from "@agent-control-tower/domain";

const createFastify = Fastify as unknown as (opts?: object) => any;

const mockBudgetManager: BudgetManager = {
  checkBudget: () => ({ allowed: true, reason: "", teamBudgetRemaining: 1000, agentBudgetRemaining: 100 }),
  recordSpend: () => {},
  setTeamBudget: () => {},
  setAgentBudget: () => {},
  getTeamBudget: () => null,
  getAgentBudget: () => null,
  listTeamBudgets: () => [],
  resetDailyBudgets: () => {},
  resetMonthlyBudgets: () => {},
};
const mockAuditLogger: AuditLogger = {
  log: () => {},
  query: () => ({ items: [], total: 0 }),
};

describe("agents API", () => {
  it("GET /api/agents returns list from registry", async () => {
    const registry = new InMemoryAgentRegistry();
    registry.ensureExists("default", "agent-1");
    const logStore = new InMemoryLogStore();
    const app = createFastify();
    registerAuthMiddleware(app);
    registerProxyRoutes(app, registry, logStore, mockBudgetManager, mockAuditLogger);
    app.get("/api/agents", async (req: { workspaceId?: string }) => {
      const workspaceId = (req as { workspaceId?: string }).workspaceId ?? "default";
      return { items: registry.list(workspaceId) };
    });

    try {
      const res = await app.inject({
        method: "GET",
        url: "/api/agents",
        headers: { "x-workspace-id": "default" },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(Array.isArray(body.items)).toBe(true);
      expect(body.items.length).toBe(1);
      expect(body.items[0].id).toBe("agent-1");
    } finally {
      await app.close();
    }
  });

  it("POST /api/agents creates agent", async () => {
    const registry = new InMemoryAgentRegistry();
    const app = createFastify();
    registerAuthMiddleware(app);
    app.post("/api/agents", async (req: { body?: Record<string, unknown>; workspaceId?: string }) => {
      const workspaceId = (req as { workspaceId?: string }).workspaceId ?? "default";
      const body = req.body as Omit<import("@agent-control-tower/domain").AgentRecord, "id">;
      return registry.create(workspaceId, body);
    });

    try {
      const res = await app.inject({
        method: "POST",
        url: "/api/agents",
        headers: { "content-type": "application/json", "x-workspace-id": "default" },
        payload: {
          name: "New Agent",
          owner: "u1",
          sponsor: "s1",
          status: "active",
          allowedTools: [],
          allowedDataScopes: [],
          description: "Test",
        },
      });
      expect(res.statusCode).toBe(200);
      const agent = JSON.parse(res.body);
      expect(agent.id).toBeDefined();
      expect(agent.name).toBe("New Agent");
    } finally {
      await app.close();
    }
  });

  it("PATCH /api/agents/:id updates agent", async () => {
    const registry = new InMemoryAgentRegistry();
    const created = registry.ensureExists("default", "patch-me");
    const app = createFastify();
    registerAuthMiddleware(app);
    app.patch("/api/agents/:id", async (req: { params: { id: string }; body?: Record<string, unknown>; workspaceId?: string }) => {
      const workspaceId = (req as { workspaceId?: string }).workspaceId ?? "default";
      const { id } = (req as { params: { id: string } }).params;
      const body = (req as { body?: Record<string, unknown> }).body ?? {};
      const updated = registry.update(workspaceId, id, body as Partial<import("@agent-control-tower/domain").AgentRecord>);
      if (!updated) throw { statusCode: 404, message: "Agent not found" };
      return updated;
    });

    try {
      const res = await app.inject({
        method: "PATCH",
        url: "/api/agents/patch-me",
        headers: { "content-type": "application/json", "x-workspace-id": "default" },
        payload: { name: "Updated Name" },
      });
      expect(res.statusCode).toBe(200);
      const agent = JSON.parse(res.body);
      expect(agent.name).toBe("Updated Name");
      expect(agent.id).toBe("patch-me");
    } finally {
      await app.close();
    }
  });

  it("proxy auto-registers unknown agent", async () => {
    const registry = new InMemoryAgentRegistry();
    const logStore = new InMemoryLogStore();
    const app = createFastify();
    registerAuthMiddleware(app);
    registerProxyRoutes(app, registry, logStore, mockBudgetManager, mockAuditLogger);
    app.get("/api/agents", async (req: { workspaceId?: string }) => {
      const workspaceId = (req as { workspaceId?: string }).workspaceId ?? "default";
      return { items: registry.list(workspaceId) };
    });

    try {
      await app.inject({
        method: "POST",
        url: "/v1/chat/completions",
        headers: {
          "content-type": "application/json",
          "x-agent-id": "auto-agent-1",
          "x-team-id": "team-1",
          "x-workspace-id": "default",
        },
        payload: JSON.stringify({ model: "gpt-4", messages: [] }),
      });
      const listRes = await app.inject({
        method: "GET",
        url: "/api/agents",
        headers: { "x-workspace-id": "default" },
      });
      const body = JSON.parse(listRes.body);
      const found = body.items?.find((a: { id: string }) => a.id === "auto-agent-1");
      expect(found).toBeDefined();
      expect(found.name).toContain("Auto-registered");
    } finally {
      await app.close();
    }
  });
});
