import { eq, and } from "drizzle-orm";
import type { AgentRegistry } from "../agent-registry";
import type { AgentRecord } from "../types";
import type { Database } from "./connection";
import schema from "./schema.js";

const { agents } = schema;

function rowToRecord(r: any): AgentRecord {
  return {
    id: r.id,
    name: r.name,
    owner: r.owner ?? "",
    sponsor: r.sponsor ?? "",
    status: r.status as AgentRecord["status"],
    allowedTools: r.allowedTools ? (typeof r.allowedTools === 'string' ? JSON.parse(r.allowedTools) : r.allowedTools) : [],
    allowedDataScopes: r.allowedDataScopes ? (typeof r.allowedDataScopes === 'string' ? JSON.parse(r.allowedDataScopes) : r.allowedDataScopes) : [],
    description: r.description ?? "",
  };
}

export function createAgentRegistry(db: Database): AgentRegistry {
  const now = () => new Date().toISOString();

  return {
    async list(workspaceId: string): Promise<AgentRecord[]> {
      const rows = db
        .select()
        .from(agents)
        .where(eq(agents.workspaceId, workspaceId))
        .all();
      return rows.map(rowToRecord);
    },

    async getById(workspaceId: string, id: string): Promise<AgentRecord | undefined> {
      const row = db
        .select()
        .from(agents)
        .where(and(eq(agents.workspaceId, workspaceId), eq(agents.id, id)))
        .get();
      return row ? rowToRecord(row) : undefined;
    },

    async create(workspaceId: string, agent: Omit<AgentRecord, "id">): Promise<AgentRecord> {
      const id = crypto.randomUUID();
      const createdAt = now();
      const values = {
        id,
        workspaceId,
        name: agent.name,
        owner: agent.owner,
        sponsor: agent.sponsor,
        description: agent.description,
        status: agent.status,
        allowedTools: JSON.stringify(agent.allowedTools),
        allowedDataScopes: JSON.stringify(agent.allowedDataScopes),
        autoRegistered: 0,
        createdAt,
        lastSeenAt: createdAt,
      };

      db.insert(agents).values(values).run();
      return { ...agent, id };
    },

    async update(
      workspaceId: string,
      id: string,
      patch: Partial<Omit<AgentRecord, "id">>
    ): Promise<AgentRecord | undefined> {
      const lastSeenAt = now();
      const updateData = {
        ...(patch.name !== undefined && { name: patch.name }),
        ...(patch.owner !== undefined && { owner: patch.owner }),
        ...(patch.sponsor !== undefined && { sponsor: patch.sponsor }),
        ...(patch.description !== undefined && { description: patch.description }),
        ...(patch.status !== undefined && { status: patch.status }),
        ...(patch.allowedTools !== undefined && {
          allowedTools: JSON.stringify(patch.allowedTools),
        }),
        ...(patch.allowedDataScopes !== undefined && {
          allowedDataScopes: JSON.stringify(patch.allowedDataScopes),
        }),
        lastSeenAt,
      };

      db.update(agents)
        .set(updateData)
        .where(and(eq(agents.workspaceId, workspaceId), eq(agents.id, id)))
        .run();

      return this.getById(workspaceId, id);
    },

    async ensureExists(workspaceId: string, agentId: string): Promise<AgentRecord> {
      const existing = await this.getById(workspaceId, agentId);
      if (existing) {
        const lastSeenAt = now();
        db.update(agents)
          .set({ lastSeenAt })
          .where(and(eq(agents.workspaceId, workspaceId), eq(agents.id, agentId)))
          .run();
        return existing;
      }

      const createdAt = now();
      const record: AgentRecord = {
        id: agentId,
        name: `Auto-registered: ${agentId}`,
        owner: "",
        sponsor: "",
        status: "active",
        allowedTools: [],
        allowedDataScopes: [],
        description: "Auto-registered on first proxy request",
      };
      
      const values = {
        id: record.id,
        workspaceId,
        name: record.name,
        owner: record.owner,
        sponsor: record.sponsor,
        description: record.description,
        status: record.status,
        allowedTools: "[]",
        allowedDataScopes: "[]",
        autoRegistered: 1,
        createdAt,
        lastSeenAt: createdAt,
      };

      db.insert(agents).values(values).run();
      return record;
    },
  };
}
