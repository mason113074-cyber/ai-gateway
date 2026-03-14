import * as os from "node:os";
import * as path from "node:path";
import { describe, it, expect } from "vitest";
import { createDatabase } from "./connection";
import { createSqliteLogStore } from "./sqlite-log-store";

const canLoadSqlite = (() => {
  try {
    createDatabase(":memory:");
    return true;
  } catch {
    return false;
  }
})();

describe.runIf(canLoadSqlite)("SqliteLogStore", () => {
  it("appends and lists logs", () => {
    const db = createDatabase(":memory:");
    const store = createSqliteLogStore(db);
    store.append({
      id: "1",
      timestamp: new Date().toISOString(),
      workspaceId: "default",
      agentId: "agent-a",
      teamId: "team-1",
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
    const list = store.list({ limit: 10 });
    expect(list).toHaveLength(1);
    expect(list[0].agentId).toBe("agent-a");
    expect(list[0].model).toBe("gpt-4");
  });

  it("filters by agentId and teamId", () => {
    const db = createDatabase(":memory:");
    const store = createSqliteLogStore(db);
    store.append({
      id: "1",
      timestamp: new Date().toISOString(),
      workspaceId: "default",
      agentId: "agent-a",
      teamId: "team-1",
      provider: "openai",
      model: "gpt-4",
      endpoint: "/v1/chat",
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
      workspaceId: "default",
      agentId: "agent-b",
      teamId: "team-1",
      provider: "openai",
      model: "gpt-3.5",
      endpoint: "/v1/chat",
      requestTokens: null,
      responseTokens: null,
      totalTokens: null,
      latencyMs: 60,
      statusCode: 200,
      costUsd: null,
      error: null,
    });
    expect(store.list({ agentId: "agent-a" })).toHaveLength(1);
    expect(store.list({ teamId: "team-1" })).toHaveLength(2);
  });

  it("getStats returns totals and byModel", () => {
    const db = createDatabase(":memory:");
    const store = createSqliteLogStore(db);
    store.append({
      id: "1",
      timestamp: new Date().toISOString(),
      workspaceId: "default",
      agentId: "a",
      teamId: "t",
      provider: "openai",
      model: "gpt-4",
      endpoint: "/v1/chat",
      requestTokens: 5,
      responseTokens: 10,
      totalTokens: 15,
      latencyMs: 100,
      statusCode: 200,
      costUsd: 0.02,
      error: null,
    });
    store.append({
      id: "2",
      timestamp: new Date().toISOString(),
      workspaceId: "default",
      agentId: "a",
      teamId: "t",
      provider: "openai",
      model: "gpt-4",
      endpoint: "/v1/chat",
      requestTokens: 5,
      responseTokens: 5,
      totalTokens: 10,
      latencyMs: 80,
      statusCode: 200,
      costUsd: 0.01,
      error: null,
    });
    const stats = store.getStats();
    expect(stats.totalRequests).toBe(2);
    expect(stats.totalCostUsd).toBe(0.03);
    expect(stats.totalTokens).toBe(25);
    expect(stats.byModel["gpt-4"].requests).toBe(2);
    expect(stats.byModel["gpt-4"].costUsd).toBe(0.03);
    expect(stats.byModel["gpt-4"].tokens).toBe(25);
  });

  it("data survives across store instances (re-open same DB)", () => {
    const tmp = path.join(os.tmpdir(), `gateway-test-${Date.now()}.db`);
    const db1 = createDatabase(tmp);
    const store1 = createSqliteLogStore(db1);
    store1.append({
      id: "persist-1",
      timestamp: new Date().toISOString(),
      workspaceId: "default",
      agentId: "x",
      teamId: "y",
      provider: "openai",
      model: "gpt-4",
      endpoint: "/v1/chat",
      requestTokens: null,
      responseTokens: null,
      totalTokens: null,
      latencyMs: 1,
      statusCode: 200,
      costUsd: null,
      error: null,
    });
    const db2 = createDatabase(tmp);
    const store2 = createSqliteLogStore(db2);
    const list = store2.list({ limit: 10 });
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe("persist-1");
  });
});
