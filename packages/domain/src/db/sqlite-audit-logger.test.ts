import { describe, it, expect } from "vitest";
import { createDatabase } from "./connection";
import { createAuditLogger } from "./audit-logger";

const canLoadSqlite = (() => {
  try {
    createDatabase(":memory:");
    return true;
  } catch {
    return false;
  }
})();

describe.runIf(canLoadSqlite)("SqliteAuditLogger", () => {
  it("log and query return items", async () => {
    const db = createDatabase(":memory:");
    const logger = createAuditLogger(db);
    await logger.log("ws1", {
      eventType: "proxy.request",
      actorType: "agent",
      actorId: "agent-1",
      action: "proxy",
      outcome: "success",
      metadata: { model: "gpt-4" },
    });
    const result = await logger.query({ workspaceId: "ws1", limit: 10 });
    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.items[0].eventType).toBe("proxy.request");
    expect(result.items[0].actorId).toBe("agent-1");
    expect(result.items[0].metadata).toEqual({ model: "gpt-4" });
  });

  it("query with filters", async () => {
    const db = createDatabase(":memory:");
    const logger = createAuditLogger(db);
    await logger.log("ws1", {
      eventType: "proxy.request",
      actorType: "agent",
      actorId: "a1",
      action: "proxy",
      outcome: "success",
    });
    await logger.log("ws1", {
      eventType: "policy.deny",
      actorType: "agent",
      actorId: "a2",
      action: "deny",
      outcome: "denied",
    });
    const all = await logger.query({ workspaceId: "ws1" });
    expect(all.items).toHaveLength(2);
    const filtered = await logger.query({ workspaceId: "ws1", eventType: "policy.deny" });
    expect(filtered.items).toHaveLength(1);
    expect(filtered.items[0].eventType).toBe("policy.deny");
    const byActor = await logger.query({ workspaceId: "ws1", actorId: "a1" });
    expect(byActor.items).toHaveLength(1);
    expect(byActor.items[0].actorId).toBe("a1");
  });

  it("pagination with limit and offset", async () => {
    const db = createDatabase(":memory:");
    const logger = createAuditLogger(db);
    for (let i = 0; i < 5; i++) {
      await logger.log("ws1", {
        eventType: "proxy.request",
        actorType: "agent",
        actorId: `agent-${i}`,
        action: "proxy",
        outcome: "success",
      });
    }
    const page1 = await logger.query({ workspaceId: "ws1", limit: 2, offset: 0 });
    expect(page1.items).toHaveLength(2);
    expect(page1.total).toBe(5);
    const page2 = await logger.query({ workspaceId: "ws1", limit: 2, offset: 2 });
    expect(page2.items).toHaveLength(2);
    expect(page2.total).toBe(5);
  });
});
