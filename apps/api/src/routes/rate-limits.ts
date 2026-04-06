import {
  rateLimitWindowKeyAgent,
  rateLimitWindowKeyGlobal,
  rateLimitWindowKeyTeam,
} from "../rate-limit-keys.js";
import { requirePermission } from "../require-permission.js";
import type { AppRouteDeps } from "./deps.js";
import type { AuthedRequest } from "./types.js";
import type { RouteApp } from "./route-app.js";

function windowKeyForConfig(
  workspaceId: string,
  targetType: "team" | "agent" | "global",
  targetId: string
): string {
  if (targetType === "global") {
    return rateLimitWindowKeyGlobal(workspaceId);
  }
  if (targetType === "team") {
    return rateLimitWindowKeyTeam(workspaceId, targetId);
  }
  return rateLimitWindowKeyAgent(workspaceId, targetId);
}

export function registerRateLimitRoutes(app: RouteApp, deps: AppRouteDeps): void {
  const { rateLimiter, rateLimitConfigStore } = deps;

  app.get(
    "/api/rate-limits",
    { preHandler: [requirePermission("read:rate-limits")] },
    async (request: AuthedRequest) => {
      const workspaceId = request.workspaceId ?? "default";
      return { items: rateLimitConfigStore.list(workspaceId) };
    }
  );

  app.post(
    "/api/rate-limits",
    { preHandler: [requirePermission("write:rate-limits")] },
    async (
      request: AuthedRequest & {
        body?: {
          targetType?: "team" | "agent" | "global";
          targetId?: string;
          requestsPerMinute?: number;
          tokensPerMinute?: number;
          burstMultiplier?: number;
        };
      }
    ) => {
      const workspaceId = request.workspaceId ?? "default";
      const { targetType, targetId, requestsPerMinute, tokensPerMinute, burstMultiplier } =
        request.body ?? {};
      if (!targetType || !targetId || requestsPerMinute == null) {
        throw { statusCode: 400, message: "targetType, targetId, and requestsPerMinute required" };
      }
      return rateLimitConfigStore.upsert(workspaceId, targetType, targetId, {
        requestsPerMinute,
        tokensPerMinute,
        burstMultiplier,
      });
    }
  );

  app.delete(
    "/api/rate-limits/:id",
    { preHandler: [requirePermission("write:rate-limits")] },
    async (request: AuthedRequest & { params?: { id: string } }) => {
      const workspaceId = request.workspaceId ?? "default";
      const id = request.params?.id;
      if (!id) throw { statusCode: 400, message: "id required" };
      const deleted = rateLimitConfigStore.remove(workspaceId, id);
      if (!deleted) throw { statusCode: 404, message: "Rate limit config not found" };
      return { deleted: true };
    }
  );

  app.get(
    "/api/rate-limits/status",
    { preHandler: [requirePermission("read:rate-limits")] },
    async (request: AuthedRequest) => {
      const workspaceId = request.workspaceId ?? "default";
      const configs = rateLimitConfigStore.list(workspaceId);
      return {
        items: configs.map((config) => {
          const key = windowKeyForConfig(workspaceId, config.targetType, config.targetId);
          const result = rateLimiter.check(key, {
            requestsPerMinute: config.requestsPerMinute,
            tokensPerMinute: config.tokensPerMinute ?? undefined,
            burstMultiplier: config.burstMultiplier,
          });
          const effectiveLimit =
            config.requestsPerMinute * 2 * (config.burstMultiplier || 1.5);
          const utilizationPct =
            effectiveLimit > 0
              ? Math.round((1 - result.remaining / effectiveLimit) * 100)
              : 0;
          return {
            ...config,
            windowKey: key,
            currentUsage: {
              remaining: result.remaining,
              limit: result.limit,
              resetAt: result.resetAt,
              utilizationPct: Math.min(100, Math.max(0, utilizationPct)),
            },
          };
        }),
      };
    }
  );
}
