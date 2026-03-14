import { describe, expect, it } from "vitest";
import type { FastifyRequest } from "fastify";
import Fastify from "fastify";
import { registerAuthMiddleware } from "./auth-middleware.js";

const createFastify = Fastify as unknown as (opts?: object) => any;

describe("auth middleware and session", () => {
  it("attaches workspaceId and userId from headers to request", async () => {
    const app = createFastify();
    registerAuthMiddleware(app);
    app.get("/session", async (request: FastifyRequest) => ({
      workspaceId: request.workspaceId ?? null,
      userId: request.userId ?? null,
    }));

    try {
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
    } finally {
      await app.close();
    }
  });

  it("returns null when headers are missing", async () => {
    const app = createFastify();
    registerAuthMiddleware(app);
    app.get("/session", async (request: FastifyRequest) => ({
      workspaceId: request.workspaceId ?? null,
      userId: request.userId ?? null,
    }));

    try {
      const res = await app.inject({
        method: "GET",
        url: "/session",
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.workspaceId).toBe(null);
      expect(body.userId).toBe(null);
    } finally {
      await app.close();
    }
  });
});
