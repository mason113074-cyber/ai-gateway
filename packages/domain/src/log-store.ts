import type { ProxyRequestLog } from "./proxy-types";

export interface LogStore {
  append(log: ProxyRequestLog): void;
  list(opts?: {
    agentId?: string;
    teamId?: string;
    limit?: number;
  }): ProxyRequestLog[];
  getStats(opts?: {
    agentId?: string;
    teamId?: string;
  }): {
    totalRequests: number;
    totalCostUsd: number;
    totalTokens: number;
    byModel: Record<
      string,
      { requests: number; costUsd: number; tokens: number }
    >;
  };
}

export class InMemoryLogStore implements LogStore {
  private logs: ProxyRequestLog[] = [];

  append(log: ProxyRequestLog): void {
    this.logs.push(log);
  }

  list(opts?: {
    agentId?: string;
    teamId?: string;
    limit?: number;
  }): ProxyRequestLog[] {
    let result = this.logs;
    if (opts?.agentId)
      result = result.filter((l) => l.agentId === opts.agentId);
    if (opts?.teamId)
      result = result.filter((l) => l.teamId === opts.teamId);
    result = result.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    if (opts?.limit) result = result.slice(0, opts.limit);
    return result;
  }

  getStats(opts?: { agentId?: string; teamId?: string }) {
    const filtered = this.list(opts);
    const byModel: Record<
      string,
      { requests: number; costUsd: number; tokens: number }
    > = {};
    let totalCostUsd = 0;
    let totalTokens = 0;

    for (const log of filtered) {
      const m = log.model || "unknown";
      if (!byModel[m])
        byModel[m] = { requests: 0, costUsd: 0, tokens: 0 };
      byModel[m].requests++;
      byModel[m].costUsd += log.costUsd ?? 0;
      byModel[m].tokens += log.totalTokens ?? 0;
      totalCostUsd += log.costUsd ?? 0;
      totalTokens += log.totalTokens ?? 0;
    }

    return {
      totalRequests: filtered.length,
      totalCostUsd,
      totalTokens,
      byModel,
    };
  }
}
