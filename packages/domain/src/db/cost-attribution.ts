import { eq, gte, lte, sql, and } from "drizzle-orm";
import type { Database } from "./connection";
import schema from "./schema.js";

const { proxyLogs } = schema;

export interface CostAttributionRow {
  groupKey: string;
  totalCostUsd: number;
  totalTokens: number;
  requestCount: number;
}

export async function queryCostAttribution(
  db: Database,
  workspaceId: string,
  opts: {
    groupBy: "team" | "agent" | "model" | "team,model";
    startDate?: string;
    endDate?: string;
  }
): Promise<CostAttributionRow[]> {
  type GroupByField = typeof proxyLogs.teamId | typeof proxyLogs.agentId | typeof proxyLogs.model;
  const conditions = [eq(proxyLogs.workspaceId, workspaceId)];
  if (opts.startDate)
    conditions.push(gte(proxyLogs.timestamp, opts.startDate as any));
  if (opts.endDate)
    conditions.push(lte(proxyLogs.timestamp, opts.endDate as any));
  const whereClause = and(...conditions);

  let groupField: GroupByField | ReturnType<typeof sql<string>>;
  if (opts.groupBy === "team") {
    groupField = proxyLogs.teamId;
  } else if (opts.groupBy === "agent") {
    groupField = proxyLogs.agentId;
  } else if (opts.groupBy === "model") {
    groupField = proxyLogs.model;
  } else {
    // team,model
    groupField = sql<string>`${proxyLogs.teamId} || ':' || ${proxyLogs.model}`;
  }

  const query = db
    .select({
      groupKey: groupField,
      totalCostUsd: sql<number>`COALESCE(SUM(${proxyLogs.costUsd}), 0)`,
      totalTokens: sql<number>`COALESCE(SUM(${proxyLogs.totalTokens}), 0)`,
      requestCount: sql<number>`COUNT(*)`,
    })
    .from(proxyLogs)
    .where(whereClause);

  if (opts.groupBy === "team") {
    query.groupBy(proxyLogs.teamId);
  } else if (opts.groupBy === "agent") {
    query.groupBy(proxyLogs.agentId);
  } else if (opts.groupBy === "model") {
    query.groupBy(proxyLogs.model);
  } else {
    query.groupBy(proxyLogs.teamId, proxyLogs.model);
  }

  const rows = (query as any).all();
  
  return rows.map((r: any) => ({
    groupKey: String(r.groupKey),
    totalCostUsd: Number(r.totalCostUsd),
    totalTokens: Number(r.totalTokens),
    requestCount: Number(r.requestCount),
  }));
}
