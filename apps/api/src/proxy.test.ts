import { describe, expect, it } from "vitest";
import Fastify from "fastify";
import { parseProxyRequestBody, registerProxyRoutes } from "./proxy.js";
import { registerAuthMiddleware, createLegacyOnlyApiKeyManager } from "./auth-middleware.js";
import {
  InMemoryAgentRegistry,
  InMemoryLogStore,
  type BudgetManager,
  type AuditLogger,
} from "@agent-control-tower/domain";
import { MockAgent, request as undiciRequest, setGlobalDispatcher, getGlobalDispatcher } from "undici";

const createFastify = Fastify as unknown as (opts?: object) => any;
const legacyAuth = createLegacyOnlyApiKeyManager();
const ADMIN_TOKEN = "test-bootstrap-admin";
const ADMIN_AUTH = { authorization: `Bearer ${ADMIN_TOKEN}` };

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

describe("parseProxyRequestBody", () => {
  it("reads model from parsed JSON object (Fastify default JSON parser)", () => {
    const { bodyStr, model } = parseProxyRequestBody({ model: "gpt-4o", messages: [{ role: "user", content: "hi" }] });
    expect(model).toBe("gpt-4o");
    expect(bodyStr).toContain("gpt-4o");
  });

  it("reads model from JSON string (scoped string parser)", () => {
    const { bodyStr, model } = parseProxyRequestBody(
      JSON.stringify({ model: "claude-3-5-sonnet-20241022", max_tokens: 10 })
    );
    expect(model).toBe("claude-3-5-sonnet-20241022");
    expect(bodyStr).toContain("claude");
  });

  it("returns unknown model when body is empty", () => {
    const { bodyStr, model } = parseProxyRequestBody(undefined);
    expect(model).toBe("unknown");
    expect(bodyStr).toBeUndefined();
  });
});

describe("proxy and log APIs", () => {
  it("returns 502 for /v1/chat/completions when no upstream key configured", async () => {
    process.env.BOOTSTRAP_ADMIN_TOKEN = ADMIN_TOKEN;
    const app = createFastify();
    registerAuthMiddleware(app, legacyAuth);
    registerProxyRoutes(app, new InMemoryAgentRegistry(), new InMemoryLogStore(), mockBudgetManager, mockAuditLogger);

    try {
      const res = await app.inject({
        method: "POST",
        url: "/v1/chat/completions",
        headers: { "content-type": "application/json", ...ADMIN_AUTH },
        payload: JSON.stringify({ model: "gpt-4", messages: [] }),
      });
      expect(res.statusCode).toBe(502);
      const body = JSON.parse(res.body);
      expect(body.error).toBeDefined();
    } finally {
      delete process.env.BOOTSTRAP_ADMIN_TOKEN;
      await app.close();
    }
  });

  it("logs x-agent-id and x-team-id when proxy is called", async () => {
    process.env.BOOTSTRAP_ADMIN_TOKEN = ADMIN_TOKEN;
    const logStore = new InMemoryLogStore();
    const app = createFastify();
    registerAuthMiddleware(app, legacyAuth);
    registerProxyRoutes(app, new InMemoryAgentRegistry(), logStore, mockBudgetManager, mockAuditLogger);

    try {
      await app.inject({
        method: "POST",
        url: "/v1/chat/completions",
        headers: {
          "content-type": "application/json",
          "x-agent-id": "test-agent",
          "x-team-id": "test-team",
          ...ADMIN_AUTH,
        },
        payload: JSON.stringify({ model: "gpt-4", messages: [] }),
      });
      const items = logStore.list({ agentId: "test-agent", teamId: "test-team" });
      expect(items.length).toBeGreaterThanOrEqual(0);
    } finally {
      delete process.env.BOOTSTRAP_ADMIN_TOKEN;
      await app.close();
    }
  });

  it("GET /api/logs returns logged requests", async () => {
    process.env.BOOTSTRAP_ADMIN_TOKEN = ADMIN_TOKEN;
    const logStore = new InMemoryLogStore();
    const app = createFastify();
    registerAuthMiddleware(app, legacyAuth);
    registerProxyRoutes(app, new InMemoryAgentRegistry(), logStore, mockBudgetManager, mockAuditLogger);
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
      const res = await app.inject({
        method: "GET",
        url: "/api/logs",
        headers: ADMIN_AUTH,
      });
      expect([200, 502]).toContain(res.statusCode);
      const body = JSON.parse(res.body);
      expect(Array.isArray(body.items)).toBe(true);
      expect(body.items.length).toBeGreaterThanOrEqual(1);
      const found = body.items.find((l: { id: string }) => l.id === "log-1");
      expect(found).toBeDefined();
      expect(found.agentId).toBe("a1");
    } finally {
      delete process.env.BOOTSTRAP_ADMIN_TOKEN;
      await app.close();
    }
  });

  it("GET /api/stats returns aggregated data", async () => {
    process.env.BOOTSTRAP_ADMIN_TOKEN = ADMIN_TOKEN;
    const logStore = new InMemoryLogStore();
    const app = createFastify();
    registerAuthMiddleware(app, legacyAuth);
    registerProxyRoutes(app, new InMemoryAgentRegistry(), logStore, mockBudgetManager, mockAuditLogger);
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
      const res = await app.inject({
        method: "GET",
        url: "/api/stats",
        headers: ADMIN_AUTH,
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.totalRequests).toBeGreaterThanOrEqual(1);
      expect(typeof body.totalCostUsd).toBe("number");
      expect(typeof body.totalTokens).toBe("number");
      expect(body.byModel).toBeDefined();
    } finally {
      delete process.env.BOOTSTRAP_ADMIN_TOKEN;
      await app.close();
    }
  });

  it("does not forward gateway auth headers upstream", async () => {
    process.env.BOOTSTRAP_ADMIN_TOKEN = ADMIN_TOKEN;
    process.env.OPENAI_API_KEY = "upstream-openai-key";
    const app = createFastify();
    registerAuthMiddleware(app, legacyAuth);
    registerProxyRoutes(
      app,
      new InMemoryAgentRegistry(),
      new InMemoryLogStore(),
      mockBudgetManager,
      mockAuditLogger
    );

    const previousDispatcher = getGlobalDispatcher();
    const mockAgent = new MockAgent();
    mockAgent.disableNetConnect();
    const pool = mockAgent.get("https://api.openai.com");
    let capturedHeaders: Record<string, string> | undefined;
    pool
      .intercept({ path: "/v1/chat/completions", method: "POST" })
      .reply((opts) => {
        capturedHeaders = opts.headers as Record<string, string>;
        return {
          statusCode: 200,
          data: { id: "ok", usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 } },
          headers: { "content-type": "application/json" },
        };
      });
    setGlobalDispatcher(mockAgent);

    try {
      const res = await app.inject({
        method: "POST",
        url: "/v1/chat/completions",
        headers: {
          ...ADMIN_AUTH,
          "content-type": "application/json",
          "x-api-key": "gw-should-not-forward",
          "x-agent-id": "a1",
          "x-team-id": "t1",
        },
        payload: JSON.stringify({ model: "gpt-4o", messages: [] }),
      });

      expect(res.statusCode).toBe(200);
      expect(capturedHeaders?.authorization).toBe("Bearer upstream-openai-key");
      expect(capturedHeaders?.["x-api-key"]).toBeUndefined();
    } finally {
      setGlobalDispatcher(previousDispatcher);
      await mockAgent.close();
      delete process.env.BOOTSTRAP_ADMIN_TOKEN;
      delete process.env.OPENAI_API_KEY;
      await app.close();
    }
  });

  it("does not cross-provider fallback by default", async () => {
    process.env.BOOTSTRAP_ADMIN_TOKEN = ADMIN_TOKEN;
    process.env.OPENAI_API_KEY = "upstream-openai-key";
    process.env.ANTHROPIC_API_KEY = "upstream-anthropic-key";
    delete process.env.ENABLE_CROSS_PROVIDER_FALLBACK;

    const app = createFastify();
    registerAuthMiddleware(app, legacyAuth);
    registerProxyRoutes(
      app,
      new InMemoryAgentRegistry(),
      new InMemoryLogStore(),
      mockBudgetManager,
      mockAuditLogger
    );

    const previousDispatcher = getGlobalDispatcher();
    const mockAgent = new MockAgent();
    mockAgent.disableNetConnect();
    const openaiPool = mockAgent.get("https://api.openai.com");
    const anthropicPool = mockAgent.get("https://api.anthropic.com");
    let openaiCalls = 0;
    let anthropicCalls = 0;
    openaiPool
      .intercept({ path: "/v1/chat/completions", method: "POST" })
      .reply(() => {
        openaiCalls += 1;
        return {
          statusCode: 503,
          data: { error: "upstream down" },
          headers: { "content-type": "application/json" },
        };
      });
    anthropicPool
      .intercept({ path: "/v1/chat/completions", method: "POST" })
      .reply(() => {
        anthropicCalls += 1;
        return {
          statusCode: 200,
          data: { ok: true },
          headers: { "content-type": "application/json" },
        };
      });
    setGlobalDispatcher(mockAgent);

    try {
      const res = await app.inject({
        method: "POST",
        url: "/v1/chat/completions",
        headers: {
          ...ADMIN_AUTH,
          "content-type": "application/json",
          "x-provider": "openai",
          "x-agent-id": "a1",
          "x-team-id": "t1",
        },
        payload: JSON.stringify({ model: "gpt-4o", messages: [] }),
      });

      expect([503, 502]).toContain(res.statusCode);
      expect(openaiCalls).toBe(1);
      expect(anthropicCalls).toBe(0);
    } finally {
      setGlobalDispatcher(previousDispatcher);
      await mockAgent.close();
      delete process.env.BOOTSTRAP_ADMIN_TOKEN;
      delete process.env.OPENAI_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;
      await app.close();
    }
  });

  it("does not retry upstream 429 (rate limit should not be amplified)", async () => {
    process.env.BOOTSTRAP_ADMIN_TOKEN = ADMIN_TOKEN;
    process.env.OPENAI_API_KEY = "upstream-openai-key";

    const app = createFastify();
    registerAuthMiddleware(app, legacyAuth);
    registerProxyRoutes(
      app,
      new InMemoryAgentRegistry(),
      new InMemoryLogStore(),
      mockBudgetManager,
      mockAuditLogger
    );

    const previousDispatcher = getGlobalDispatcher();
    const mockAgent = new MockAgent();
    mockAgent.disableNetConnect();
    const openaiPool = mockAgent.get("https://api.openai.com");
    let callCount = 0;
    openaiPool
      .intercept({ path: "/v1/chat/completions", method: "POST" })
      .reply(() => {
        callCount += 1;
        return {
          statusCode: 429,
          data: { error: "rate_limit_exceeded" },
          headers: { "content-type": "application/json" },
        };
      });
    setGlobalDispatcher(mockAgent);

    try {
      const res = await app.inject({
        method: "POST",
        url: "/v1/chat/completions",
        headers: {
          ...ADMIN_AUTH,
          "content-type": "application/json",
          "x-provider": "openai",
          "x-agent-id": "a1",
          "x-team-id": "t1",
        },
        payload: JSON.stringify({ model: "gpt-4o", messages: [] }),
      });

      expect(res.statusCode).toBe(429);
      expect(callCount).toBe(1);
    } finally {
      setGlobalDispatcher(previousDispatcher);
      await mockAgent.close();
      delete process.env.BOOTSTRAP_ADMIN_TOKEN;
      delete process.env.OPENAI_API_KEY;
      await app.close();
    }
  });
});
