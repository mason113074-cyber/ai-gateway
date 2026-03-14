import type { RawDatabase } from "./db/connection.js";
import type { RateLimitConfig } from "./rate-limiter.js";

export interface RateLimitConfigRecord {
  id: string;
  workspaceId: string;
  targetType: "team" | "agent" | "global";
  targetId: string;
  requestsPerMinute: number;
  tokensPerMinute: number | null;
  burstMultiplier: number;
  createdAt: string;
  updatedAt: string;
}

export interface RateLimitConfigStore {
  get(
    workspaceId: string,
    targetType: string,
    targetId: string
  ): RateLimitConfigRecord | null;
  upsert(
    workspaceId: string,
    targetType: string,
    targetId: string,
    config: {
      requestsPerMinute: number;
      tokensPerMinute?: number;
      burstMultiplier?: number;
    }
  ): RateLimitConfigRecord;
  list(workspaceId: string): RateLimitConfigRecord[];
  remove(workspaceId: string, id: string): boolean;
  getEffectiveConfig(
    workspaceId: string,
    teamId: string,
    agentId: string
  ): {
    teamConfig: RateLimitConfig | null;
    agentConfig: RateLimitConfig | null;
    globalConfig: RateLimitConfig | null;
  };
}

function rowToRecord(row: {
  id: string;
  workspace_id: string;
  target_type: string;
  target_id: string;
  requests_per_minute: number;
  tokens_per_minute: number | null;
  burst_multiplier: number;
  created_at: string;
  updated_at: string;
}): RateLimitConfigRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    targetType: row.target_type as "team" | "agent" | "global",
    targetId: row.target_id,
    requestsPerMinute: row.requests_per_minute,
    tokensPerMinute: row.tokens_per_minute,
    burstMultiplier: row.burst_multiplier,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function recordToConfig(r: RateLimitConfigRecord): RateLimitConfig {
  return {
    requestsPerMinute: r.requestsPerMinute,
    tokensPerMinute: r.tokensPerMinute ?? undefined,
    burstMultiplier: r.burstMultiplier,
  };
}

export function createSqliteRateLimitConfigStore(
  raw: RawDatabase
): RateLimitConfigStore {
  const getStmt = raw.prepare(
    `SELECT * FROM rate_limit_configs
     WHERE workspace_id = ? AND target_type = ? AND target_id = ?`
  );
  const getByIdStmt = raw.prepare(
    `SELECT * FROM rate_limit_configs WHERE id = ? AND workspace_id = ?`
  );
  const listStmt = raw.prepare(
    `SELECT * FROM rate_limit_configs WHERE workspace_id = ? ORDER BY target_type, target_id`
  );
  const insertStmt = raw.prepare(
    `INSERT INTO rate_limit_configs (id, workspace_id, target_type, target_id, requests_per_minute, tokens_per_minute, burst_multiplier, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       requests_per_minute = excluded.requests_per_minute,
       tokens_per_minute = excluded.tokens_per_minute,
       burst_multiplier = excluded.burst_multiplier,
       updated_at = excluded.updated_at`
  );
  const deleteStmt = raw.prepare(
    `DELETE FROM rate_limit_configs WHERE id = ? AND workspace_id = ?`
  );
  const getGlobalStmt = raw.prepare(
    `SELECT * FROM rate_limit_configs
     WHERE workspace_id = ? AND target_type = 'global' LIMIT 1`
  );
  const getTeamStmt = raw.prepare(
    `SELECT * FROM rate_limit_configs
     WHERE workspace_id = ? AND target_type = 'team' AND target_id = ? LIMIT 1`
  );
  const getAgentStmt = raw.prepare(
    `SELECT * FROM rate_limit_configs
     WHERE workspace_id = ? AND target_type = 'agent' AND target_id = ? LIMIT 1`
  );

  return {
    get(
      workspaceId: string,
      targetType: string,
      targetId: string
    ): RateLimitConfigRecord | null {
      const row = getStmt.get(
        workspaceId,
        targetType,
        targetId
      ) as ReturnType<typeof getStmt.get>;
      if (!row || typeof row !== "object") return null;
      return rowToRecord(row as Parameters<typeof rowToRecord>[0]);
    },

    upsert(
      workspaceId: string,
      targetType: string,
      targetId: string,
      config: {
        requestsPerMinute: number;
        tokensPerMinute?: number;
        burstMultiplier?: number;
      }
    ): RateLimitConfigRecord {
      const id = `${workspaceId}:${targetType}:${targetId}`;
      const now = new Date().toISOString();
      const burst = config.burstMultiplier ?? 1.5;
      insertStmt.run(
        id,
        workspaceId,
        targetType,
        targetId,
        config.requestsPerMinute,
        config.tokensPerMinute ?? null,
        burst,
        now,
        now
      );
      return {
        id,
        workspaceId,
        targetType: targetType as "team" | "agent" | "global",
        targetId,
        requestsPerMinute: config.requestsPerMinute,
        tokensPerMinute: config.tokensPerMinute ?? null,
        burstMultiplier: burst,
        createdAt: now,
        updatedAt: now,
      };
    },

    list(workspaceId: string): RateLimitConfigRecord[] {
      const rows = listStmt.all(workspaceId) as Parameters<
        typeof rowToRecord
      >[0][];
      return (rows ?? []).map(rowToRecord);
    },

    remove(workspaceId: string, id: string): boolean {
      const info = deleteStmt.run(id, workspaceId) as { changes: number };
      return (info?.changes ?? 0) > 0;
    },

    getEffectiveConfig(
      workspaceId: string,
      teamId: string,
      agentId: string
    ): {
      teamConfig: RateLimitConfig | null;
      agentConfig: RateLimitConfig | null;
      globalConfig: RateLimitConfig | null;
    } {
      const globalRow = getGlobalStmt.get(workspaceId) as ReturnType<
        typeof getGlobalStmt.get
      >;
      const teamRow = getTeamStmt.get(workspaceId, teamId) as ReturnType<
        typeof getTeamStmt.get
      >;
      const agentRow = getAgentStmt.get(workspaceId, agentId) as ReturnType<
        typeof getAgentStmt.get
      >;

      return {
        globalConfig: globalRow
          ? recordToConfig(
              rowToRecord(globalRow as Parameters<typeof rowToRecord>[0])
            )
          : null,
        teamConfig: teamRow
          ? recordToConfig(
              rowToRecord(teamRow as Parameters<typeof rowToRecord>[0])
            )
          : null,
        agentConfig: agentRow
          ? recordToConfig(
              rowToRecord(agentRow as Parameters<typeof rowToRecord>[0])
            )
          : null,
      };
    },
  };
}
