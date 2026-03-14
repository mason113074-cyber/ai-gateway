import { describe, expect, it } from "vitest";
import type { FastifyRequest } from "fastify";
import Fastify from "fastify";
import type { ApiKeyManager } from "@agent-control-tower/domain";
import { registerAuthMiddleware } from "./auth-middleware.js";
import { requirePermission } from "./require-permission.js";

function createMockApiKeyManager(overrides: {
  lookupByKey?: (rawKey: string) => import("@agent-control-tower/domain").ApiKeyRecord | null;
  updateLastUsed?: (id: string) => void;
} = {}): ApiKeyManager {
  const lookupByKey = overrides.lookupByKey ?? (() => null);
  const updateLastUsed = overrides.updateLastUsed ?? (() => {});
  return {
    create: () => ({ record: {} as import("@agent-control-tower/domain").ApiKeyRecord, rawKey: "" }),
    list: () => [],
    revoke: () => true,
    update: () => null,
    lookupByKey,
    updateLastUsed,
  };
}

function mockKeyRecord(partial: {
  id: string;
  workspaceId: string;
  userId: string | null;
  teamId: string | null;
  permissions: string[];
  allowedModels: string[] | null;
}): import("@agent-control-tower/domain").ApiKeyRecord {
  return {
    ...partial,
    name: "mock",
    keyPrefix: "gw-xxxx",
    rateLimit: null,
    expiresAt: null,
    lastUsedAt: null,
    createdAt: new Date().toISOString(),
  };
}

const createFastify = Fastify as unknown as (opts?: object) => any;

describe("auth middleware and session", () => {
  it("attaches workspaceId and userId from headers when no API key (legacy)", async () => {
    const app = createFastify();
    registerAuthMiddleware(app, createMockApiKeyManager());
    app.get("/session", async (request: FastifyRequest) => ({
      workspaceId: request.workspaceId ?? null,
      userId: request.userId ?? null,
      permissions: (request as any).permissions ?? null,
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
    expect(body.permissions).toEqual(["admin"]);
  });

  it("returns null when headers are missing (legacy)", async () => {
    const app = createFastify();
    registerAuthMiddleware(app, createMockApiKeyManager());
    app.get("/session", async (request: FastifyRequest) => ({
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

  it("authenticates valid API key via Authorization header", async () => {
    const app = createFastify();
    const mockManager = createMockApiKeyManager({
      lookupByKey: (rawKey) =>
        rawKey === "gw-valid-key"
          ? mockKeyRecord({
              id: "key-1",
              workspaceId: "ws-api",
              userId: "u1",
              teamId: "team-1",
              permissions: ["proxy", "read:logs"],
              allowedModels: ["gpt-4o"],
            })
          : null,
    });
    registerAuthMiddleware(app, mockManager);
    app.get("/session", async (request: FastifyRequest) => ({
      workspaceId: request.workspaceId,
      userId: request.userId,
      permissions: (request as any).permissions,
      allowedModels: (request as any).allowedModels,
    }));

    const res = await app.inject({
      method: "GET",
      url: "/session",
      headers: { authorization: "Bearer gw-valid-key" },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.workspaceId).toBe("ws-api");
    expect(body.userId).toBe("u1");
    expect(body.permissions).toEqual(["proxy", "read:logs"]);
    expect(body.allowedModels).toEqual(["gpt-4o"]);
  });

  it("authenticates valid API key via x-api-key header", async () => {
    const app = createFastify();
    registerAuthMiddleware(app, createMockApiKeyManager({
      lookupByKey: () => mockKeyRecord({
        id: "k2",
        workspaceId: "ws2",
        userId: null,
        teamId: null,
        permissions: ["read:audit"],
        allowedModels: null,
      }),
    }));
    app.get("/session", async (request: FastifyRequest) => ({
      workspaceId: request.workspaceId,
      permissions: (request as any).permissions,
    }));

    const res = await app.inject({
      method: "GET",
      url: "/session",
      headers: { "x-api-key": "gw-abc123" },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.workspaceId).toBe("ws2");
    expect(body.permissions).toEqual(["read:audit"]);
  });

  it("returns 401 for invalid API key", async () => {
    const app = createFastify();
    registerAuthMiddleware(app, createMockApiKeyManager({ lookupByKey: () => null }));
    app.get("/session", async () => ({ ok: true }));

    const res = await app.inject({
      method: "GET",
      url: "/session",
      headers: { authorization: "Bearer gw-invalid-key" },
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.error).toBe("Invalid API key");
  });

  it("allows request with sufficient permissions", async () => {
    const app = createFastify();
    registerAuthMiddleware(app, createMockApiKeyManager());
    app.get("/logs", { preHandler: [requirePermission("read:logs")] }, async () => ({ items: [] }));

    const res = await app.inject({
      method: "GET",
      url: "/logs",
      headers: { "x-workspace-id": "default" },
    });

    expect(res.statusCode).toBe(200);
  });

  it("denies request with insufficient permissions (403)", async () => {
    const app = createFastify();
    registerAuthMiddleware(app, createMockApiKeyManager({
      lookupByKey: () => mockKeyRecord({
        id: "k",
        workspaceId: "ws",
        userId: null,
        teamId: null,
        permissions: ["read:logs"],
        allowedModels: null,
      }),
    }));
    app.post("/agents", { preHandler: [requirePermission("write:agents")] }, async () => ({ id: "a1" }));

    const res = await app.inject({
      method: "POST",
      url: "/agents",
      headers: { "x-api-key": "gw-viewer-key", "content-type": "application/json" },
      payload: { name: "Test" },
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body);
    expect(body.error).toBe("Insufficient permissions");
    expect(body.required).toBe("write:agents");
  });

  it("allows admin key to access everything", async () => {
    const app = createFastify();
    registerAuthMiddleware(app, createMockApiKeyManager({
      lookupByKey: () => mockKeyRecord({
        id: "admin-key",
        workspaceId: "ws",
        userId: null,
        teamId: null,
        permissions: ["admin"],
        allowedModels: null,
      }),
    }));
    app.delete("/keys/:id", { preHandler: [requirePermission("manage:keys")] }, async () => ({ deleted: true }));

    const res = await app.inject({
      method: "DELETE",
      url: "/keys/key-1",
      headers: { "x-api-key": "gw-admin-key" },
    });

    expect(res.statusCode).toBe(200);
  });
});
