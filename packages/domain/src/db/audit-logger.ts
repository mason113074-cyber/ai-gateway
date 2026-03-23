import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import type { AuditLogger, AuditEntry } from "../audit";
import type { Database } from "./connection";
import schema from "./schema.js";

const { auditLogs } = schema;

export function createAuditLogger(db: Database): AuditLogger {
  const isPg = "execute" in db && !("run" in db);

  return {
    async log(workspaceId: string, entry: Omit<AuditEntry, "id">): Promise<void> {
      const id = crypto.randomUUID();
      const timestamp = isPg ? new Date() : new Date().toISOString();
      const values = {
        id,
        timestamp,
        workspaceId,
        eventType: entry.eventType,
        actorType: entry.actorType,
        actorId: entry.actorId,
        targetType: entry.targetType ?? null,
        targetId: entry.targetId ?? null,
        action: entry.action,
        outcome: entry.outcome,
        metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
      };

      if (isPg) {
        await (db as any).insert(auditLogs).values(values).execute();
      } else {
        (db as any).insert(auditLogs).values(values).run();
      }
    },

    async query(opts: {
      workspaceId: string;
      eventType?: string;
      actorId?: string;
      startDate?: string;
      endDate?: string;
      limit?: number;
      offset?: number;
    }) {
      const conditions = [eq(auditLogs.workspaceId, opts.workspaceId)];
      if (opts.eventType) conditions.push(eq(auditLogs.eventType, opts.eventType));
      if (opts.actorId) conditions.push(eq(auditLogs.actorId, opts.actorId));
      if (opts.startDate) conditions.push(gte(auditLogs.timestamp, opts.startDate as any));
      if (opts.endDate) conditions.push(lte(auditLogs.timestamp, opts.endDate as any));
      const where = and(...conditions);
      const limit = opts.limit ?? 100;
      const offset = opts.offset ?? 0;

      const totalQuery = db
        .select({ count: sql<number>`COUNT(*)`.as("c") })
        .from(auditLogs)
        .where(where);
      
      const totalRow = isPg ? (await (totalQuery as any).execute())[0] : (totalQuery as any).get();
      const total = Number(totalRow?.count ?? 0);

      const query = db
        .select()
        .from(auditLogs)
        .where(where)
        .orderBy(desc(auditLogs.timestamp))
        .limit(limit)
        .offset(offset);

      const rows = isPg ? await (query as any).execute() : (query as any).all();

      const items = rows.map((r: any) => ({
        id: r.id,
        timestamp: r.timestamp instanceof Date ? r.timestamp.toISOString() : r.timestamp,
        eventType: r.eventType,
        actorType: r.actorType as "agent" | "user" | "system",
        actorId: r.actorId,
        targetType: r.targetType ?? undefined,
        targetId: r.targetId ?? undefined,
        action: r.action,
        outcome: r.outcome as "success" | "denied" | "error",
        metadata: r.metadata ? JSON.parse(r.metadata) : undefined,
      }));

      return { items, total };
    },
  };
}
