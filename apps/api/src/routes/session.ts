import type { AuthedRequest } from "./types.js";
import type { RouteApp } from "./route-app.js";

export function registerSessionRoutes(app: RouteApp): void {
  app.get("/api/session", async (request: AuthedRequest) => ({
    workspaceId: request.workspaceId ?? null,
    userId: request.userId ?? null,
    permissions: request.permissions ?? null,
  }));
}
