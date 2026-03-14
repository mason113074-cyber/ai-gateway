import { describe, expect, it } from "vitest";
import { InMemoryLogStore } from "./log-store";

describe("InMemoryLogStore", () => {
  it("appends and lists logs", () => {
    const store = new InMemoryLogStore();
    store.append({
      id: "1",
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
    const list = store.list();
    expect(list).toHaveLength(1);
    expect(list[0].agentId).toBe("a1");
    expect(list[0].model).toBe("gpt-4");
  });

  it("filters list by agentId and teamId", () => {
    const store = new InMemoryLogStore();
    store.append({
      id: "1",
      timestamp: new Date().toISOString(),
      workspaceId: "ws1",
      agentId: "a1",
      teamId: "t1",
      provider: "openai",
      model: "gpt-4",
      endpoint: "/v1/chat/completions",
      requestTokens: null,
      responseTokens: null,
      totalTokens: null,
      latencyMs: 50,
      statusCode: 200,
      costUsd: null,
      error: null,
    });
    store.append({
      id: "2",
      timestamp: new Date().toISOString(),
      workspaceId: "ws1",
      agentId: "a2",
      teamId: "t1",
      provider: "openai",
      model: "gpt-4",
      endpoint: "/v1/chat/completions",
      requestTokens: null,
      responseTokens: null,
      totalTokens: null,
      latencyMs: 60,
      statusCode: 200,
      costUsd: null,
      error: null,
    });
    expect(store.list({ agentId: "a1" })).toHaveLength(1);
    expect(store.list({ teamId: "t1" })).toHaveLength(2);
    expect(store.list({ agentId: "a1", teamId: "t1" })).toHaveLength(1);
  });

  it("respects limit", () => {
    const store = new InMemoryLogStore();
    for (let i = 0; i < 5; i++) {
      store.append({
        id: String(i),
        timestamp: new Date().toISOString(),
        workspaceId: "ws1",
        agentId: "a1",
        teamId: "t1",
        provider: "openai",
        model: "gpt-4",
        endpoint: "/v1/chat/completions",
        requestTokens: null,
        responseTokens: null,
        totalTokens: null,
        latencyMs: 50,
        statusCode: 200,
        costUsd: null,
        error: null,
      });
    }
    expect(store.list({ limit: 2 })).toHaveLength(2);
  });

  it("getStats aggregates by model", () => {
    const store = new InMemoryLogStore();
    store.append({
      id: "1",
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
    store.append({
      id: "2",
      timestamp: new Date().toISOString(),
      workspaceId: "ws1",
      agentId: "a1",
      teamId: "t1",
      provider: "openai",
      model: "gpt-4",
      endpoint: "/v1/chat/completions",
      requestTokens: 5,
      responseTokens: 15,
      totalTokens: 20,
      latencyMs: 80,
      statusCode: 200,
      costUsd: 0.005,
      error: null,
    });
    store.append({
      id: "3",
      timestamp: new Date().toISOString(),
      workspaceId: "ws1",
      agentId: "a1",
      teamId: "t1",
      provider: "openai",
      model: "gpt-3.5-turbo",
      endpoint: "/v1/chat/completions",
      requestTokens: 2,
      responseTokens: 8,
      totalTokens: 10,
      latencyMs: 40,
      statusCode: 200,
      costUsd: 0.001,
      error: null,
    });
    const stats = store.getStats();
    expect(stats.totalRequests).toBe(3);
    expect(stats.totalCostUsd).toBeCloseTo(0.016);
    expect(stats.totalTokens).toBe(60);
    expect(stats.byModel["gpt-4"].requests).toBe(2);
    expect(stats.byModel["gpt-4"].costUsd).toBeCloseTo(0.015);
    expect(stats.byModel["gpt-3.5-turbo"].requests).toBe(1);
  });
});
