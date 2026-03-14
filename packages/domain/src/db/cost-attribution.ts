import { eq, gte, lte, sql, and } from "drizzle-orm";
import type { Database } from "./connection";
import { proxyLogs } from "./schema";

export interface CostAttributionRow {
  groupKey: string;
  totalCostUsd: number;
  totalTokens: number;
  requestCount: number;
}

export function queryCostAttribution(
  db: Database,
  workspaceId: string,
  opts: {
    groupBy: "team" | "agent" | "model" | "team,model";
    startDate?: string;
    endDate?: string;
  }
): CostAttributionRow[] {
  const conditions = [eq(proxyLogs.workspaceId, workspaceId)];
  if (opts.startDate)
    conditions.push(gte(proxyLogs.timestamp, opts.startDate));
  if (opts.endDate)
    conditions.push(lte(proxyLogs.timestamp, opts.endDate));
  const whereClause = and(...conditions);

  if (opts.groupBy === "team") {
    const rows = db
      .select({
        groupKey: proxyLogs.teamId,
        totalCostUsd: sql<number>`COALESCE(SUM(${proxyLogs.costUsd}), 0)`,
        totalTokens: sql<number>`COALESCE(SUM(${proxyLogs.totalTokens}), 0)`,
        requestCount: sql<number>`COUNT(*)`,
      })
      .from(proxyLogs)
      .where(whereClause)
      .groupBy(proxyLogs.teamId)
      .all();
    return rows.map((r) => ({
      groupKey: r.groupKey,
      totalCostUsd: Number(r.totalCostUsd),
      totalTokens: Number(r.totalTokens),
      requestCount: Number(r.requestCount),
    }));
  }

  if (opts.groupBy === "agent") {
    const rows = db
      .select({
        groupKey: proxyLogs.agentId,
        totalCostUsd: sql<number>`COALESCE(SUM(${proxyLogs.costUsd}), 0)`,
        totalTokens: sql<number>`COALESCE(SUM(${proxyLogs.totalTokens}), 0)`,
        requestCount: sql<number>`COUNT(*)`,
      })
      .from(proxyLogs)
      .where(whereClause)
      .groupBy(proxyLogs.agentId)
      .all();
    return rows.map((r) => ({
      groupKey: r.groupKey,
      totalCostUsd: Number(r.totalCostUsd),
      totalTokens: Number(r.totalTokens),
      requestCount: Number(r.requestCount),
    }));
  }

  if (opts.groupBy === "model") {
    const rows = db
      .select({
        groupKey: proxyLogs.model,
        totalCostUsd: sql<number>`COALESCE(SUM(${proxyLogs.costUsd}), 0)`,
        totalTokens: sql<number>`COALESCE(SUM(${proxyLogs.totalTokens}), 0)`,
        requestCount: sql<number>`COUNT(*)`,
      })
      .from(proxyLogs)
      .where(whereClause)
      .groupBy(proxyLogs.model)
      .all();
    return rows.map((r) => ({
      groupKey: r.groupKey,
      totalCostUsd: Number(r.totalCostUsd),
      totalTokens: Number(r.totalTokens),
      requestCount: Number(r.requestCount),
    }));
  }

  // team,model
  const rows = db
    .select({
      groupKey: sql<string>`${proxyLogs.teamId} || ':' || ${proxyLogs.model}`,
      totalCostUsd: sql<number>`COALESCE(SUM(${proxyLogs.costUsd}), 0)`,
      totalTokens: sql<number>`COALESCE(SUM(${proxyLogs.totalTokens}), 0)`,
      requestCount: sql<number>`COUNT(*)`,
    })
    .from(proxyLogs)
    .where(whereClause)
    .groupBy(proxyLogs.teamId, proxyLogs.model)
    .all();
  return rows.map((r) => ({
    groupKey: String(r.groupKey),
    totalCostUsd: Number(r.totalCostUsd),
    totalTokens: Number(r.totalTokens),
    requestCount: Number(r.requestCount),
  }));
}
