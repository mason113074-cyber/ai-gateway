import { queryCostAttribution } from "@agent-control-tower/domain";
import { requirePermission } from "../require-permission.js";
import type { AppRouteDeps } from "./deps.js";
import type { AuthedRequest, CostGroupBy } from "./types.js";
import type { RouteApp } from "./route-app.js";

export function registerCostRoutes(app: RouteApp, deps: AppRouteDeps): void {
  const { db } = deps;

  app.get(
    "/api/costs",
    { preHandler: [requirePermission("read:costs")] },
    async (
      request: AuthedRequest & {
        query?: { groupBy?: string; startDate?: string; endDate?: string };
      }
    ) => {
      const workspaceId = request.workspaceId ?? "default";
      const { groupBy, startDate, endDate } = request.query ?? {};
      const validGroupBy: CostGroupBy =
        groupBy === "team" || groupBy === "agent" || groupBy === "model" || groupBy === "team,model"
          ? groupBy
          : "team";
      const result = await queryCostAttribution(db, workspaceId, {
        groupBy: validGroupBy,
        startDate,
        endDate,
      });
      return { items: result };
    }
  );
}
