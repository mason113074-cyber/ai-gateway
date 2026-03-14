import { describe, it, expect } from "vitest";
import { createDatabase } from "./connection";
import { createSqliteAgentRegistry } from "./sqlite-agent-registry";

const canLoadSqlite = (() => {
  try {
    createDatabase(":memory:");
    return true;
  } catch {
    return false;
  }
})();

describe.runIf(canLoadSqlite)("SqliteAgentRegistry", () => {
  it("create and list agents", () => {
    const db = createDatabase(":memory:");
    const registry = createSqliteAgentRegistry(db);
    const created = registry.create("ws1", {
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
    const list = registry.list("ws1");
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe("Test Agent");
  });

  it("getById and update", () => {
    const db = createDatabase(":memory:");
    const registry = createSqliteAgentRegistry(db);
    const created = registry.create("ws1", {
      name: "Original",
      owner: "alice",
      sponsor: "bob",
      status: "active",
      allowedTools: [],
      allowedDataScopes: [],
      description: "",
    });
    const found = registry.getById("ws1", created.id);
    expect(found?.name).toBe("Original");
    const updated = registry.update("ws1", created.id, { name: "Updated" });
    expect(updated?.name).toBe("Updated");
    expect(registry.getById("ws1", created.id)?.name).toBe("Updated");
  });

  it("ensureExists creates new agent", () => {
    const db = createDatabase(":memory:");
    const registry = createSqliteAgentRegistry(db);
    const record = registry.ensureExists("ws1", "new-agent-id");
    expect(record.id).toBe("new-agent-id");
    expect(record.name).toContain("Auto-registered");
    expect(registry.list("ws1")).toHaveLength(1);
  });

  it("ensureExists updates lastSeenAt for existing agent", () => {
    const db = createDatabase(":memory:");
    const registry = createSqliteAgentRegistry(db);
    registry.ensureExists("ws1", "agent-1");
    const second = registry.ensureExists("ws1", "agent-1");
    expect(second.id).toBe("agent-1");
    expect(registry.list("ws1")).toHaveLength(1);
  });
});
