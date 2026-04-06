import { requirePermission } from "../require-permission.js";
import type { AppRouteDeps } from "./deps.js";
import type { AuthedRequest } from "./types.js";
import type { RouteApp } from "./route-app.js";

export function registerKeyRoutes(app: RouteApp, deps: AppRouteDeps): void {
  const { apiKeyManager } = deps;

  app.post(
    "/api/keys",
    { preHandler: [requirePermission("manage:keys")] },
    async (
      request: AuthedRequest & {
        body?: {
          name?: string;
          teamId?: string;
          permissions?: string[];
          allowedModels?: string[];
          rateLimit?: number;
          expiresAt?: string;
        };
      }
    ) => {
      const workspaceId = request.workspaceId ?? "default";
      const { name, teamId, permissions, allowedModels, rateLimit, expiresAt } =
        request.body ?? {};
      if (!name || !Array.isArray(permissions)) {
        throw { statusCode: 400, message: "name and permissions required" };
      }
      const result = apiKeyManager.create(workspaceId, {
        name,
        userId: request.userId,
        teamId,
        permissions,
        allowedModels,
        rateLimit,
        expiresAt,
      });
      return { ...result.record, rawKey: result.rawKey };
    }
  );

  app.get(
    "/api/keys",
    { preHandler: [requirePermission("read:keys")] },
    async (request: AuthedRequest) => {
      const workspaceId = request.workspaceId ?? "default";
      return { items: apiKeyManager.list(workspaceId) };
    }
  );

  app.delete(
    "/api/keys/:id",
    { preHandler: [requirePermission("manage:keys")] },
    async (request: AuthedRequest & { params?: { id: string } }) => {
      const workspaceId = request.workspaceId ?? "default";
      const id = request.params?.id;
      if (!id) throw { statusCode: 400, message: "id required" };
      const deleted = apiKeyManager.revoke(workspaceId, id);
      if (!deleted) throw { statusCode: 404, message: "Key not found" };
      return { deleted: true };
    }
  );

  app.patch(
    "/api/keys/:id",
    { preHandler: [requirePermission("manage:keys")] },
    async (
      request: AuthedRequest & {
        params?: { id: string };
        body?: { name?: string; permissions?: string[]; allowedModels?: string[]; rateLimit?: number };
      }
    ) => {
      const workspaceId = request.workspaceId ?? "default";
      const id = request.params?.id;
      if (!id) throw { statusCode: 400, message: "id required" };
      const updated = apiKeyManager.update(workspaceId, id, request.body ?? {});
      if (!updated) throw { statusCode: 404, message: "Key not found" };
      return updated;
    }
  );
}
