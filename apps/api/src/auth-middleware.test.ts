import { describe, expect, it } from "vitest";
import Fastify from "fastify";
import { registerAuthMiddleware } from "./auth-middleware.js";

describe("auth middleware and session", () => {
  it("attaches workspaceId and userId from headers to request", async () => {
    const app = Fastify();
    registerAuthMiddleware(app);
    app.get("/session", async (request) => ({
      workspaceId: request.workspaceId ?? null,
      userId: request.userId ?? null,
    }));

    const res = await app.inject({
      method: "GET",
      url: "/session",
      headers: {
        "x-workspace-id": "ws-1",
        "x-user-id": "user-1",
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.workspaceId).toBe("ws-1");
    expect(body.userId).toBe("user-1");
  });

  it("returns null when headers are missing", async () => {
    const app = Fastify();
    registerAuthMiddleware(app);
    app.get("/session", async (request) => ({
      workspaceId: request.workspaceId ?? null,
      userId: request.userId ?? null,
    }));

    const res = await app.inject({
      method: "GET",
      url: "/session",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.workspaceId).toBe(null);
    expect(body.userId).toBe(null);
  });
});
