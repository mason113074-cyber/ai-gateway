import type { AgentRecord } from "./types";

export interface AgentRegistry {
  list(workspaceId: string): AgentRecord[] | Promise<AgentRecord[]>;
  getById(
    workspaceId: string,
    id: string
  ): AgentRecord | undefined | Promise<AgentRecord | undefined>;
  create(
    workspaceId: string,
    agent: Omit<AgentRecord, "id">
  ): AgentRecord | Promise<AgentRecord>;
  update(
    workspaceId: string,
    id: string,
    patch: Partial<Omit<AgentRecord, "id">>
  ): AgentRecord | undefined | Promise<AgentRecord | undefined>;
  ensureExists(
    workspaceId: string,
    agentId: string
  ): AgentRecord | Promise<AgentRecord>;
}

export class InMemoryAgentRegistry implements AgentRegistry {
  private byWorkspace = new Map<string, Map<string, AgentRecord>>();

  private workspace(workspaceId: string): Map<string, AgentRecord> {
    let map = this.byWorkspace.get(workspaceId);
    if (!map) {
      map = new Map();
      this.byWorkspace.set(workspaceId, map);
    }
    return map;
  }

  list(workspaceId: string): AgentRecord[] {
    return Array.from(this.workspace(workspaceId).values());
  }

  getById(workspaceId: string, id: string): AgentRecord | undefined {
    return this.workspace(workspaceId).get(id);
  }

  create(
    workspaceId: string,
    agent: Omit<AgentRecord, "id">
  ): AgentRecord {
    const id = crypto.randomUUID();
    const record: AgentRecord = { ...agent, id };
    this.workspace(workspaceId).set(id, record);
    return record;
  }

  update(
    workspaceId: string,
    id: string,
    patch: Partial<Omit<AgentRecord, "id">>
  ): AgentRecord | undefined {
    const existing = this.workspace(workspaceId).get(id);
    if (!existing) return undefined;
    const updated: AgentRecord = { ...existing, ...patch, id };
    this.workspace(workspaceId).set(id, updated);
    return updated;
  }

  ensureExists(workspaceId: string, agentId: string): AgentRecord {
    const map = this.workspace(workspaceId);
    let record = map.get(agentId);
    if (record) return record;
    record = {
      id: agentId,
      name: `Auto-registered: ${agentId}`,
      owner: "",
      sponsor: "",
      status: "active",
      allowedTools: [],
      allowedDataScopes: [],
      description: "Auto-registered on first proxy request",
    };
    map.set(agentId, record);
    return record;
  }
}
