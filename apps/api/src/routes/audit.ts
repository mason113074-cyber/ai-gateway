import { mockApprovals, mockAuditEvents } from "@agent-control-tower/domain";
import { requirePermission } from "../require-permission.js";
import type { AppRouteDeps } from "./deps.js";
import type { AuthedRequest } from "./types.js";
import type { RouteApp } from "./route-app.js";

export function registerAuditRoutes(app: RouteApp, deps: AppRouteDeps): void {
  const { auditLogger } = deps;

  app.get("/api/approvals", { preHandler: [requirePermission("read:audit")] }, async () => ({
    items: mockApprovals,
  }));

  app.get("/api/audit", { preHandler: [requirePermission("read:audit")] }, async () => ({
    items: mockAuditEvents,
  }));

  app.get(
    "/api/audit-logs",
    { preHandler: [requirePermission("read:audit")] },
    async (
      request: AuthedRequest & {
        query?: {
          eventType?: string;
          actorId?: string;
          startDate?: string;
          endDate?: string;
          limit?: string;
          offset?: string;
        };
      }
    ) => {
      const workspaceId = request.workspaceId ?? "default";
      const q = request.query ?? {};
      return await auditLogger.query({
        workspaceId,
        eventType: q.eventType,
        actorId: q.actorId,
        startDate: q.startDate,
        endDate: q.endDate,
        limit: q.limit ? Number(q.limit) : 100,
        offset: q.offset ? Number(q.offset) : 0,
      });
    }
  );
}
