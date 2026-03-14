import { describe, it, expect, beforeEach } from "vitest";
import { createDatabaseWithRaw } from "./db/connection.js";
import { createSlidingWindowRateLimiter } from "./rate-limiter.js";

const canLoadSqlite = (() => {
  try {
    createDatabaseWithRaw(":memory:");
    return true;
  } catch {
    return false;
  }
})();

describe.runIf(canLoadSqlite)("SlidingWindowRateLimiter", () => {
  let raw: ReturnType<typeof createDatabaseWithRaw>["raw"];
  let limiter: ReturnType<typeof createSlidingWindowRateLimiter>;

  beforeEach(() => {
    const { raw: r } = createDatabaseWithRaw(":memory:");
    raw = r;
    limiter = createSlidingWindowRateLimiter(raw);
  });

  const config = { requestsPerMinute: 10, burstMultiplier: 1.0 };

  it("allows requests under the limit", () => {
    const result = limiter.check("test:team1", config);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBeGreaterThan(0);
  });

  it("blocks requests over the limit", () => {
    for (let i = 0; i < 20; i++) {
      limiter.consume("test:team1", config);
    }
    const result = limiter.check("test:team1", config);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("tracks remaining correctly", () => {
    limiter.consume("test:team1", config, 5);
    const result = limiter.check("test:team1", config);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(15);
  });

  it("cleanup removes old windows", () => {
    const oldMinute = Math.floor(Date.now() / 60000) - 10;
    raw.prepare("INSERT INTO rate_limit_windows VALUES (?, ?, ?, ?)").run("old:key", oldMinute, 100, 0);
    limiter.cleanup();
    const row = raw.prepare("SELECT count(*) as c FROM rate_limit_windows WHERE key = ?").get("old:key") as { c: number };
    expect(row.c).toBe(0);
  });
});
