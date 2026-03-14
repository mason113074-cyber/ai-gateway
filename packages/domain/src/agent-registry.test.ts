import { describe, expect, it } from "vitest";
import { InMemoryAgentRegistry } from "./agent-registry";

describe("InMemoryAgentRegistry", () => {
  it("list returns empty for new workspace", () => {
    const registry = new InMemoryAgentRegistry();
    expect(registry.list("ws1")).toEqual([]);
  });

  it("create adds agent with generated id", () => {
    const registry = new InMemoryAgentRegistry();
    const agent = registry.create("ws1", {
      name: "Test Agent",
      owner: "u1",
      sponsor: "s1",
      status: "active",
      allowedTools: ["tool1"],
      allowedDataScopes: ["scope1"],
      description: "Test",
    });
    expect(agent.id).toBeDefined();
    expect(agent.name).toBe("Test Agent");
    expect(registry.list("ws1")).toHaveLength(1);
  });

  it("getById returns agent", () => {
    const registry = new InMemoryAgentRegistry();
    const created = registry.create("ws1", {
      name: "A",
      owner: "o",
      sponsor: "s",
      status: "active",
      allowedTools: [],
      allowedDataScopes: [],
      description: "",
    });
    expect(registry.getById("ws1", created.id)).toEqual(created);
    expect(registry.getById("ws1", "nonexistent")).toBeUndefined();
  });

  it("update patches agent", () => {
    const registry = new InMemoryAgentRegistry();
    const created = registry.create("ws1", {
      name: "A",
      owner: "o",
      sponsor: "s",
      status: "active",
      allowedTools: [],
      allowedDataScopes: [],
      description: "",
    });
    const updated = registry.update("ws1", created.id, { name: "B", status: "disabled" });
    expect(updated?.name).toBe("B");
    expect(updated?.status).toBe("disabled");
    expect(registry.update("ws1", "nonexistent", { name: "X" })).toBeUndefined();
  });

  it("ensureExists creates agent with given id if not found", () => {
    const registry = new InMemoryAgentRegistry();
    const first = registry.ensureExists("ws1", "agent-1");
    expect(first.id).toBe("agent-1");
    expect(first.name).toBe("Auto-registered: agent-1");
    expect(first.status).toBe("active");
    const second = registry.ensureExists("ws1", "agent-1");
    expect(second).toBe(first);
    expect(registry.list("ws1")).toHaveLength(1);
  });

  it("ensureExists creates multiple agents by id", () => {
    const registry = new InMemoryAgentRegistry();
    registry.ensureExists("ws1", "a1");
    registry.ensureExists("ws1", "a2");
    expect(registry.list("ws1")).toHaveLength(2);
  });
});
