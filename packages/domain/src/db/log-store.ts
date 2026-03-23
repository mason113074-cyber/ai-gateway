import { eq, desc, and, sql } from "drizzle-orm";
import type { LogStore } from "../log-store";
import type { ProxyRequestLog } from "../proxy-types";
import type { Database } from "./connection";
import schema from "./schema.js";

const { proxyLogs } = schema;

export function createLogStore(db: Database): LogStore {
  const isPg = "execute" in db && !("run" in db);

  return {
    async append(log: ProxyRequestLog): Promise<void> {
      const values = {
        id: log.id,
        timestamp: isPg ? new Date(log.timestamp) : log.timestamp,
        workspaceId: log.workspaceId,
        agentId: log.agentId,
        teamId: log.teamId,
        provider: log.provider,
        model: log.model,
        endpoint: log.endpoint,
        requestTokens: log.requestTokens,
        responseTokens: log.responseTokens,
        totalTokens: log.totalTokens,
        latencyMs: log.latencyMs,
        statusCode: log.statusCode,
        costUsd: log.costUsd,
        error: log.error,
      };

      if (isPg) {
        await (db as any).insert(proxyLogs).values(values).execute();
      } else {
        (db as any).insert(proxyLogs).values(values).run();
      }
    },

    async list(opts?: {
      agentId?: string;
      teamId?: string;
      limit?: number;
    }): Promise<ProxyRequestLog[]> {
      const conditions = [];
      if (opts?.agentId) conditions.push(eq(proxyLogs.agentId, opts.agentId));
      if (opts?.teamId) conditions.push(eq(proxyLogs.teamId, opts.teamId));
      const limit = opts?.limit ?? 1000;
      
      let query = db
        .select()
        .from(proxyLogs)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(proxyLogs.timestamp))
        .limit(limit);

      const rows = isPg ? await (query as any).execute() : (query as any).all();
      
      return rows.map((r: any) => ({
        id: r.id,
        timestamp: r.timestamp instanceof Date ? r.timestamp.toISOString() : r.timestamp,
        workspaceId: r.workspaceId,
        agentId: r.agentId,
        teamId: r.teamId,
        provider: r.provider,
        model: r.model,
        endpoint: r.endpoint,
        requestTokens: r.requestTokens,
        responseTokens: r.responseTokens,
        totalTokens: r.totalTokens,
        latencyMs: r.latencyMs,
        statusCode: r.statusCode,
        costUsd: r.costUsd,
        error: r.error,
      }));
    },

    async getStats(opts?: { agentId?: string; teamId?: string }) {
      const conditions = [];
      if (opts?.agentId) conditions.push(eq(proxyLogs.agentId, opts.agentId));
      if (opts?.teamId) conditions.push(eq(proxyLogs.teamId, opts.teamId));
      const where = conditions.length ? and(...conditions) : undefined;
      
      const query = db
        .select({
          model: proxyLogs.model,
          costUsd: sql<number>`COALESCE(SUM(${proxyLogs.costUsd}), 0)`.as("cost_usd"),
          tokens: sql<number>`COALESCE(SUM(${proxyLogs.totalTokens}), 0)`.as("tokens"),
          count: sql<number>`COUNT(*)`.as("count"),
        })
        .from(proxyLogs)
        .where(where)
        .groupBy(proxyLogs.model);

      const rows = isPg ? await (query as any).execute() : (query as any).all();
      
      const byModel: Record<
        string,
        { requests: number; costUsd: number; tokens: number }
      > = {};
      let totalCostUsd = 0;
      let totalTokens = 0;
      let totalRequests = 0;
      for (const r of rows) {
        const m = r.model ?? "unknown";
        const requests = Number(r.count);
        const costUsd = Number(r.costUsd);
        const tokens = Number(r.tokens);
        byModel[m] = { requests, costUsd, tokens };
        totalCostUsd += costUsd;
        totalTokens += tokens;
        totalRequests += requests;
      }
      return {
        totalRequests,
        totalCostUsd,
        totalTokens,
        byModel,
      };
    },
  };
}
