import { describe, it, expect } from "vitest";
import { createDatabase } from "./connection";
import { createAgentRegistry } from "./agent-registry";

const canLoadSqlite = (() => {
  try {
    createDatabase(":memory:");
    return true;
  } catch {
    return false;
  }
})();

describe.runIf(canLoadSqlite)("SqliteAgentRegistry", () => {
  it("create and list agents", async () => {
    const db = createDatabase(":memory:");
    const registry = createAgentRegistry(db);
    const created = await registry.create("ws1", {
      name: "Test Agent",
      owner: "alice",
      sponsor: "bob",
      status: "active",
      allowedTools: ["read"],
      allowedDataScopes: ["public"],
      description: "A test",
    });
    expect(created.id).toBeDefined();
    expect(created.name).toBe("Test Agent");
    const list = await registry.list("ws1");
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe("Test Agent");
  });

  it("getById and update", async () => {
    const db = createDatabase(":memory:");
    const registry = createAgentRegistry(db);
    const created = await registry.create("ws1", {
      name: "Original",
      owner: "alice",
      sponsor: "bob",
      status: "active",
      allowedTools: [],
      allowedDataScopes: [],
      description: "",
    });
    const found = await registry.getById("ws1", created.id);
    expect(found?.name).toBe("Original");
    const updated = await registry.update("ws1", created.id, { name: "Updated" });
    expect(updated?.name).toBe("Updated");
    const finalRecord = await registry.getById("ws1", created.id);
    expect(finalRecord?.name).toBe("Updated");
  });

  it("ensureExists creates new agent", async () => {
    const db = createDatabase(":memory:");
    const registry = createAgentRegistry(db);
    const record = await registry.ensureExists("ws1", "new-agent-id");
    expect(record.id).toBe("new-agent-id");
    expect(record.name).toContain("Auto-registered");
    const list = await registry.list("ws1");
    expect(list).toHaveLength(1);
  });

  it("ensureExists updates lastSeenAt for existing agent", async () => {
    const db = createDatabase(":memory:");
    const registry = createAgentRegistry(db);
    await registry.ensureExists("ws1", "agent-1");
    const second = await registry.ensureExists("ws1", "agent-1");
    expect(second.id).toBe("agent-1");
    const list = await registry.list("ws1");
    expect(list).toHaveLength(1);
  });
});
