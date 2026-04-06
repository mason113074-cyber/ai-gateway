import { requirePermission } from "../require-permission.js";
import type { AppRouteDeps } from "./deps.js";
import type { RouteApp } from "./route-app.js";

export function registerStatsRoutes(app: RouteApp, deps: AppRouteDeps): void {
  const { logStore } = deps;

  app.get(
    "/api/stats",
    { preHandler: [requirePermission("read:costs")] },
    async (request: { query?: { agentId?: string; teamId?: string } }) => {
      const { agentId, teamId } = request.query ?? {};
      return await logStore.getStats({ agentId, teamId });
    }
  );
}
