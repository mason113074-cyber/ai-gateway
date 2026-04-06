import { requirePermission } from "../require-permission.js";
import type { AppRouteDeps } from "./deps.js";
import type { AuthedRequest } from "./types.js";
import type { RouteApp } from "./route-app.js";

export function registerAgentRoutes(app: RouteApp, deps: AppRouteDeps): void {
  const { agentRegistry } = deps;

  app.get(
    "/api/agents",
    { preHandler: [requirePermission("read:agents")] },
    async (request: AuthedRequest) => {
      const workspaceId = request.workspaceId ?? "default";
      return { items: await agentRegistry.list(workspaceId) };
    }
  );

  app.post(
    "/api/agents",
    { preHandler: [requirePermission("write:agents")] },
    async (request: AuthedRequest & { body?: unknown }) => {
      const workspaceId = request.workspaceId ?? "default";
      if (!request.body || typeof request.body !== "object") {
        throw { statusCode: 400, message: "Body required" };
      }
      return await agentRegistry.create(
        workspaceId,
        request.body as Parameters<typeof agentRegistry.create>[1]
      );
    }
  );

  app.patch(
    "/api/agents/:id",
    { preHandler: [requirePermission("write:agents")] },
    async (request: AuthedRequest & { params?: { id: string }; body?: Record<string, unknown> }) => {
      const workspaceId = request.workspaceId ?? "default";
      const id = request.params?.id;
      if (!id) throw { statusCode: 400, message: "id required" };
      const agent = await agentRegistry.update(workspaceId, id, request.body ?? {});
      if (!agent) throw { statusCode: 404, message: "Agent not found" };
      return agent;
    }
  );
}
