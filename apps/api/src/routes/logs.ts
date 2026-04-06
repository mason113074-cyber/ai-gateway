import { requirePermission } from "../require-permission.js";
import type { AppRouteDeps } from "./deps.js";
import type { RouteApp } from "./route-app.js";

export function registerLogRoutes(app: RouteApp, deps: AppRouteDeps): void {
  const { logStore } = deps;

  app.get(
    "/api/logs",
    { preHandler: [requirePermission("read:logs")] },
    async (request: { query?: { agentId?: string; teamId?: string; limit?: string } }) => {
      const { agentId, teamId, limit } = request.query ?? {};
      return {
        items: await logStore.list({
          agentId,
          teamId,
          limit: limit ? Number(limit) : 100,
        }),
      };
    }
  );
}
