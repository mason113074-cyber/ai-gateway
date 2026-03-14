import { eq, and } from "drizzle-orm";
import type { AgentRegistry } from "../agent-registry";
import type { AgentRecord } from "../types";
import type { Database } from "./connection";
import { agents } from "./schema";

function rowToRecord(r: typeof agents.$inferSelect): AgentRecord {
  return {
    id: r.id,
    name: r.name,
    owner: r.owner ?? "",
    sponsor: r.sponsor ?? "",
    status: r.status as AgentRecord["status"],
    allowedTools: r.allowedTools ? JSON.parse(r.allowedTools) : [],
    allowedDataScopes: r.allowedDataScopes ? JSON.parse(r.allowedDataScopes) : [],
    description: r.description ?? "",
  };
}

export function createSqliteAgentRegistry(db: Database): AgentRegistry {
  const now = () => new Date().toISOString();
  return {
    list(workspaceId: string): AgentRecord[] {
      const rows = db
        .select()
        .from(agents)
        .where(eq(agents.workspaceId, workspaceId))
        .all();
      return rows.map(rowToRecord);
    },

    getById(workspaceId: string, id: string): AgentRecord | undefined {
      const row = db
        .select()
        .from(agents)
        .where(and(eq(agents.workspaceId, workspaceId), eq(agents.id, id)))
        .get();
      return row ? rowToRecord(row) : undefined;
    },

    create(workspaceId: string, agent: Omit<AgentRecord, "id">): AgentRecord {
      const id = crypto.randomUUID();
      const createdAt = now();
      db.insert(agents)
        .values({
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
        })
        .run();
      return { ...agent, id };
    },

    update(
      workspaceId: string,
      id: string,
      patch: Partial<Omit<AgentRecord, "id">>
    ): AgentRecord | undefined {
      const existing = db
        .select()
        .from(agents)
        .where(and(eq(agents.workspaceId, workspaceId), eq(agents.id, id)))
        .get();
      if (!existing) return undefined;
      const lastSeenAt = now();
      db.update(agents)
        .set({
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
        })
        .where(and(eq(agents.workspaceId, workspaceId), eq(agents.id, id)))
        .run();
      const updated = db
        .select()
        .from(agents)
        .where(and(eq(agents.workspaceId, workspaceId), eq(agents.id, id)))
        .get();
      return updated ? rowToRecord(updated) : undefined;
    },

    ensureExists(workspaceId: string, agentId: string): AgentRecord {
      const existing = db
        .select()
        .from(agents)
        .where(and(eq(agents.workspaceId, workspaceId), eq(agents.id, agentId)))
        .get();
      if (existing) {
        const lastSeenAt = now();
        db.update(agents)
          .set({ lastSeenAt })
          .where(and(eq(agents.workspaceId, workspaceId), eq(agents.id, agentId)))
          .run();
        return rowToRecord(existing);
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
      db.insert(agents)
        .values({
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
        })
        .run();
      return record;
    },
  };
}
