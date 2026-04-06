import type { AuditLogger, RateLimitConfig, RateLimiter } from "@agent-control-tower/domain";
import {
  rateLimitWindowKeyAgent,
  rateLimitWindowKeyGlobal,
  rateLimitWindowKeyTeam,
} from "./rate-limit-keys.js";
import type { ReplyLike } from "./proxy-types.js";

export type ProxyRateLimitOptions = {
  getRateLimitConfig?: (
    workspaceId: string,
    teamId: string,
    agentId: string
  ) => {
    teamConfig: RateLimitConfig | null;
    agentConfig: RateLimitConfig | null;
    globalConfig: RateLimitConfig | null;
  };
  rateLimiter?: RateLimiter;
};

type CheckScope = {
  config: RateLimitConfig | null;
  key: string;
  scope: "workspace" | "team" | "agent";
  bodyExtra: Record<string, unknown>;
};

/**
 * Enforces global / team / agent sliding-window checks before the upstream call.
 * Returns `false` when a 429 was already sent on `reply`.
 */
export async function checkProxyRateLimits(params: {
  workspaceId: string;
  teamId: string;
  agentId: string;
  options: ProxyRateLimitOptions | undefined;
  auditLogger: AuditLogger;
  reply: ReplyLike;
}): Promise<boolean> {
  const { workspaceId, teamId, agentId, options, auditLogger, reply } = params;
  if (!options?.rateLimiter || !options?.getRateLimitConfig) {
    return true;
  }

  const rlConfigs = options.getRateLimitConfig(workspaceId, teamId, agentId);

  const scopes: CheckScope[] = [
    {
      config: rlConfigs.globalConfig,
      key: rateLimitWindowKeyGlobal(workspaceId),
      scope: "workspace",
      bodyExtra: {},
    },
    {
      config: rlConfigs.teamConfig,
      key: rateLimitWindowKeyTeam(workspaceId, teamId),
      scope: "team",
      bodyExtra: { teamId },
    },
    {
      config: rlConfigs.agentConfig,
      key: rateLimitWindowKeyAgent(workspaceId, agentId),
      scope: "agent",
      bodyExtra: { agentId },
    },
  ];

  for (const s of scopes) {
    if (!s.config) continue;
    const result = options.rateLimiter.check(s.key, s.config);
    if (result.allowed) continue;

    await auditLogger.log(workspaceId, {
      eventType: "rate_limit.exceeded",
      actorType: "agent",
      actorId: agentId,
      targetType: "rate_limit",
      targetId: s.key,
      action: "proxy.request",
      outcome: "denied",
      metadata: {
        remaining: result.remaining,
        retryAfterSeconds: result.retryAfterSeconds,
      },
    });

    reply
      .status(429)
      .header("Retry-After", String(result.retryAfterSeconds ?? 60))
      .header("X-RateLimit-Limit", String(result.limit))
      .header("X-RateLimit-Remaining", String(result.remaining))
      .header("X-RateLimit-Reset", result.resetAt)
      .send({
        error: "Rate limit exceeded",
        scope: s.scope,
        retryAfterSeconds: result.retryAfterSeconds,
        ...s.bodyExtra,
      });
    return false;
  }

  return true;
}

/** Records usage after a successful upstream response (non-streaming uses token totals). */
export function consumeProxyRateLimitsAfterSuccess(params: {
  options: ProxyRateLimitOptions | undefined;
  workspaceId: string;
  teamId: string;
  agentId: string;
  statusCode: number;
  /** For JSON responses: total_tokens from usage; ignored when `sseMode` is true. */
  tokenCount: number;
  /** SSE path counts requests but not token volume in the sliding window. */
  sseMode: boolean;
}): void {
  const { options, workspaceId, teamId, agentId, statusCode, tokenCount, sseMode } = params;
  if (statusCode >= 400 || !options?.rateLimiter || !options?.getRateLimitConfig) {
    return;
  }

  const rlConfigs = options.getRateLimitConfig(workspaceId, teamId, agentId);
  const tokens = sseMode ? 0 : tokenCount;

  if (rlConfigs.globalConfig) {
    options.rateLimiter.consume(
      rateLimitWindowKeyGlobal(workspaceId),
      rlConfigs.globalConfig,
      1,
      tokens
    );
  }
  if (rlConfigs.teamConfig) {
    options.rateLimiter.consume(
      rateLimitWindowKeyTeam(workspaceId, teamId),
      rlConfigs.teamConfig,
      1,
      tokens
    );
  }
  if (rlConfigs.agentConfig) {
    options.rateLimiter.consume(
      rateLimitWindowKeyAgent(workspaceId, agentId),
      rlConfigs.agentConfig,
      1,
      tokens
    );
  }
}
