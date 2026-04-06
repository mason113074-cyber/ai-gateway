import { describe, expect, it, vi } from "vitest";
import type { AuditLogger } from "@agent-control-tower/domain";
import { checkProxyRateLimits, consumeProxyRateLimitsAfterSuccess } from "./proxy-rate-limit.js";
import type { ReplyLike } from "./proxy-types.js";

function makeReply(): ReplyLike {
  const chain = {
    status: vi.fn().mockReturnThis(),
    header: vi.fn().mockReturnThis(),
    send: vi.fn(),
  };
  return chain as unknown as ReplyLike;
}

const noopAudit: AuditLogger = {
  log: async () => {},
  query: () => ({ items: [], total: 0 }),
};

describe("checkProxyRateLimits", () => {
  it("allows when rate limiter is not configured", async () => {
    const reply = makeReply();
    const ok = await checkProxyRateLimits({
      workspaceId: "w",
      teamId: "t",
      agentId: "a",
      options: undefined,
      auditLogger: noopAudit,
      reply,
    });
    expect(ok).toBe(true);
    expect(reply.status).not.toHaveBeenCalled();
  });

  it("returns 429 when the global window is exceeded", async () => {
    const reply = makeReply();
    const ok = await checkProxyRateLimits({
      workspaceId: "w",
      teamId: "t",
      agentId: "a",
      options: {
        rateLimiter: {
          check: vi.fn().mockReturnValueOnce({
            allowed: false,
            remaining: 0,
            limit: 10,
            resetAt: "2026-01-01T00:00:00.000Z",
            retryAfterSeconds: 30,
          }),
          consume: vi.fn(),
          cleanup: vi.fn(),
        },
        getRateLimitConfig: () => ({
          globalConfig: { requestsPerMinute: 10 },
          teamConfig: null,
          agentConfig: null,
        }),
      },
      auditLogger: noopAudit,
      reply,
    });
    expect(ok).toBe(false);
    expect(reply.status).toHaveBeenCalledWith(429);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ error: "Rate limit exceeded", scope: "workspace" })
    );
  });
});

describe("consumeProxyRateLimitsAfterSuccess", () => {
  it("no-ops when status is an error", () => {
    const consume = vi.fn();
    consumeProxyRateLimitsAfterSuccess({
      options: {
        rateLimiter: { check: vi.fn(), consume, cleanup: vi.fn() },
        getRateLimitConfig: () => ({
          globalConfig: { requestsPerMinute: 10 },
          teamConfig: null,
          agentConfig: null,
        }),
      },
      workspaceId: "w",
      teamId: "t",
      agentId: "a",
      statusCode: 500,
      tokenCount: 100,
      sseMode: false,
    });
    expect(consume).not.toHaveBeenCalled();
  });

  it("consumes token count for JSON responses", () => {
    const consume = vi.fn();
    consumeProxyRateLimitsAfterSuccess({
      options: {
        rateLimiter: { check: vi.fn(), consume, cleanup: vi.fn() },
        getRateLimitConfig: () => ({
          globalConfig: { requestsPerMinute: 10 },
          teamConfig: null,
          agentConfig: null,
        }),
      },
      workspaceId: "w",
      teamId: "t",
      agentId: "a",
      statusCode: 200,
      tokenCount: 42,
      sseMode: false,
    });
    expect(consume).toHaveBeenCalledWith("global:w", { requestsPerMinute: 10 }, 1, 42);
  });

  it("uses zero token volume for SSE mode", () => {
    const consume = vi.fn();
    consumeProxyRateLimitsAfterSuccess({
      options: {
        rateLimiter: { check: vi.fn(), consume, cleanup: vi.fn() },
        getRateLimitConfig: () => ({
          globalConfig: { requestsPerMinute: 10 },
          teamConfig: null,
          agentConfig: null,
        }),
      },
      workspaceId: "w",
      teamId: "t",
      agentId: "a",
      statusCode: 200,
      tokenCount: 999,
      sseMode: true,
    });
    expect(consume).toHaveBeenCalledWith("global:w", { requestsPerMinute: 10 }, 1, 0);
  });
});
