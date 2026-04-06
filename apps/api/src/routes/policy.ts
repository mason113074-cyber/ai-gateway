import { evaluatePolicy, type ActionRequest } from "@agent-control-tower/domain";
import { requirePermission } from "../require-permission.js";
import type { RouteApp } from "./route-app.js";

export function registerPolicyRoutes(app: RouteApp): void {
  app.post(
    "/api/policy/evaluate",
    { preHandler: [requirePermission("write:policies")] },
    async (request: { body: ActionRequest }) => {
      return evaluatePolicy(request.body as ActionRequest);
    }
  );
}
