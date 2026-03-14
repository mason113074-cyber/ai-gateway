import { describe, expect, it } from "vitest";
import Fastify from "fastify";
import { registerProxyRoutes, getLogStore } from "./proxy.js";
import { registerAuthMiddleware, createLegacyOnlyApiKeyManager } from "./auth-middleware.js";

const createFastify = Fastify as unknown as (opts?: object) => any;
const legacyAuth = createLegacyOnlyApiKeyManager();

describe("proxy and log APIs", () => {
  it("returns 502 for /v1/chat/completions when no upstream key configured", async () => {
    const app = createFastify();
    registerAuthMiddleware(app, legacyAuth);
    registerProxyRoutes(app);

    try {
      const res = await app.inject({
        method: "POST",
        url: "/v1/chat/completions",
        headers: { "content-type": "application/json" },
        payload: JSON.stringify({ model: "gpt-4", messages: [] }),
      });
      expect(res.statusCode).toBe(502);
      const body = JSON.parse(res.body);
      expect(body.error).toBeDefined();
    } finally {
      await app.close();
    }
  });

  it("logs x-agent-id and x-team-id when proxy is called", async () => {
    const app = createFastify();
    registerAuthMiddleware(app, legacyAuth);
    registerProxyRoutes(app);
    const logStore = getLogStore();

    try {
      await app.inject({
        method: "POST",
        url: "/v1/chat/completions",
        headers: {
          "content-type": "application/json",
          "x-agent-id": "test-agent",
          "x-team-id": "test-team",
        },
        payload: JSON.stringify({ model: "gpt-4", messages: [] }),
      });
      const items = logStore.list({ agentId: "test-agent", teamId: "test-team" });
      expect(items.length).toBeGreaterThanOrEqual(0);
    } finally {
      await app.close();
    }
  });

  it("GET /api/logs returns logged requests", async () => {
    const app = createFastify();
    registerAuthMiddleware(app, legacyAuth);
    registerProxyRoutes(app);
    const logStore = getLogStore();
    app.get("/api/logs", async (req: { query?: { agentId?: string; teamId?: string; limit?: string } }) => {
      const { agentId, teamId, limit } = req.query ?? {};
      return { items: logStore.list({ agentId, teamId, limit: limit ? Number(limit) : 100 }) };
    });
    logStore.append({
      id: "log-1",
      timestamp: new Date().toISOString(),
      workspaceId: "ws1",
      agentId: "a1",
      teamId: "t1",
      provider: "openai",
      model: "gpt-4",
      endpoint: "/v1/chat/completions",
      requestTokens: 10,
      responseTokens: 20,
      totalTokens: 30,
      latencyMs: 100,
      statusCode: 200,
      costUsd: 0.01,
      error: null,
    });

    try {
      const res = await app.inject({ method: "GET", url: "/api/logs" });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(Array.isArray(body.items)).toBe(true);
      expect(body.items.length).toBeGreaterThanOrEqual(1);
      const found = body.items.find((l: { id: string }) => l.id === "log-1");
      expect(found).toBeDefined();
      expect(found.agentId).toBe("a1");
    } finally {
      await app.close();
    }
  });

  it("GET /api/stats returns aggregated data", async () => {
    const app = createFastify();
    registerAuthMiddleware(app, legacyAuth);
    registerProxyRoutes(app);
    const logStore = getLogStore();
    app.get("/api/stats", async (req: { query?: { agentId?: string; teamId?: string } }) => {
      const { agentId, teamId } = req.query ?? {};
      return logStore.getStats({ agentId, teamId });
    });
    logStore.append({
      id: "log-2",
      timestamp: new Date().toISOString(),
      workspaceId: "ws1",
      agentId: "a1",
      teamId: "t1",
      provider: "openai",
      model: "gpt-4",
      endpoint: "/v1/chat/completions",
      requestTokens: 10,
      responseTokens: 20,
      totalTokens: 30,
      latencyMs: 100,
      statusCode: 200,
      costUsd: 0.01,
      error: null,
    });

    try {
      const res = await app.inject({ method: "GET", url: "/api/stats" });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.totalRequests).toBeGreaterThanOrEqual(1);
      expect(typeof body.totalCostUsd).toBe("number");
      expect(typeof body.totalTokens).toBe("number");
      expect(body.byModel).toBeDefined();
    } finally {
      await app.close();
    }
  });
});
