import type { PiiType } from "@agent-control-tower/domain";
import { requirePermission } from "../require-permission.js";
import type { AppRouteDeps } from "./deps.js";
import type { AuthedRequest } from "./types.js";
import type { RouteApp } from "./route-app.js";

export function registerGuardrailRoutes(app: RouteApp, deps: AppRouteDeps): void {
  const { guardrailStore } = deps;

  app.get(
    "/api/guardrails",
    { preHandler: [requirePermission("read:audit")] },
    async (request: AuthedRequest) => {
      const workspaceId = request.workspaceId ?? "default";
      return { items: await guardrailStore.list(workspaceId) };
    }
  );

  app.post(
    "/api/guardrails",
    { preHandler: [requirePermission("write:policies")] },
    async (
      request: AuthedRequest & {
        body?: {
          type?: string;
          config?: { enabledTypes: PiiType[]; action: "redact" | "warn" | "block" };
          enabled?: boolean;
        };
      }
    ) => {
      const workspaceId = request.workspaceId ?? "default";
      const { type, config, enabled } = request.body ?? {};
      if (!type || !config) throw { statusCode: 400, message: "type and config required" };
      return await guardrailStore.upsert(workspaceId, type, config, enabled ?? true);
    }
  );

  app.patch(
    "/api/guardrails/:id",
    { preHandler: [requirePermission("write:policies")] },
    async (request: AuthedRequest & { params?: { id: string }; body?: { enabled?: boolean } }) => {
      const workspaceId = request.workspaceId ?? "default";
      const id = request.params?.id;
      const enabled = request.body?.enabled;
      if (!id) throw { statusCode: 400, message: "id required" };
      if (enabled === undefined) throw { statusCode: 400, message: "enabled required" };
      const result = await guardrailStore.setEnabled(workspaceId, id, enabled);
      if (!result) throw { statusCode: 404, message: "Guardrail config not found" };
      return result;
    }
  );
}
