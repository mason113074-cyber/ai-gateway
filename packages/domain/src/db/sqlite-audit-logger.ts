import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import type { AuditLogger } from "../audit";
import type { Database } from "./connection";
import { auditLogs } from "./schema";

export function createSqliteAuditLogger(db: Database): AuditLogger {
  return {
    log(workspaceId: string, entry: { eventType: string; actorType: "agent" | "user" | "system"; actorId: string; targetType?: string; targetId?: string; action: string; outcome: "success" | "denied" | "error"; metadata?: Record<string, unknown> }): void {
      const id = crypto.randomUUID();
      const timestamp = new Date().toISOString();
      db.insert(auditLogs)
        .values({
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
        })
        .run();
    },

    query(opts: {
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
      if (opts.startDate) conditions.push(gte(auditLogs.timestamp, opts.startDate));
      if (opts.endDate) conditions.push(lte(auditLogs.timestamp, opts.endDate));
      const where = and(...conditions);
      const limit = opts.limit ?? 100;
      const offset = opts.offset ?? 0;

      const totalRow = db
        .select({ count: sql<number>`COUNT(*)`.as("c") })
        .from(auditLogs)
        .where(where)
        .get();
      const total = Number(totalRow?.count ?? 0);

      const rows = db
        .select()
        .from(auditLogs)
        .where(where)
        .orderBy(desc(auditLogs.timestamp))
        .limit(limit)
        .offset(offset)
        .all();

      const items = rows.map((r) => ({
        id: r.id,
        timestamp: r.timestamp,
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
