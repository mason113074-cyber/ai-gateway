import type { RawDatabase } from "./db/connection.js";

export interface RateLimitConfig {
  requestsPerMinute: number;
  tokensPerMinute?: number;
  burstMultiplier?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetAt: string;
  retryAfterSeconds?: number;
}

export interface RateLimiter {
  check(key: string, config: RateLimitConfig): RateLimitResult;
  consume(
    key: string,
    config: RateLimitConfig,
    requestCount?: number,
    tokenCount?: number
  ): RateLimitResult;
  cleanup(): void;
}

/**
 * Sliding window rate limiter backed by SQLite.
 * Uses per-minute buckets with a 2-minute sliding window for smooth limiting.
 */
export function createSlidingWindowRateLimiter(raw: RawDatabase): RateLimiter {
  const getWindowStmt = raw.prepare(
    `SELECT COALESCE(SUM(count), 0) as total_count, COALESCE(SUM(token_count), 0) as total_tokens
     FROM rate_limit_windows
     WHERE key = ? AND window_start >= ?`
  );

  const upsertWindowStmt = raw.prepare(
    `INSERT INTO rate_limit_windows (key, window_start, count, token_count)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(key, window_start) DO UPDATE SET
       count = count + excluded.count,
       token_count = token_count + excluded.token_count`
  );

  const cleanupStmt = raw.prepare(
    `DELETE FROM rate_limit_windows WHERE window_start < ?`
  );

  function getCurrentMinute(): number {
    return Math.floor(Date.now() / 60000);
  }

  function getWindowCount(
    key: string,
    windowMinutes: number = 2
  ): { totalCount: number; totalTokens: number } {
    const cutoff = getCurrentMinute() - (windowMinutes - 1);
    const row = getWindowStmt.get(key, cutoff) as
      | { total_count: number; total_tokens: number }
      | undefined;
    return {
      totalCount: row?.total_count ?? 0,
      totalTokens: row?.total_tokens ?? 0,
    };
  }

  function checkLimit(
    key: string,
    config: RateLimitConfig
  ): RateLimitResult {
    const burst = config.burstMultiplier ?? 1.5;
    const effectiveLimit = Math.floor(
      config.requestsPerMinute * 2 * burst
    );
    const { totalCount, totalTokens } = getWindowCount(key);

    const remaining = Math.max(0, effectiveLimit - totalCount);
    const currentMinute = getCurrentMinute();
    const resetAt = new Date((currentMinute + 2) * 60000).toISOString();

    if (totalCount >= effectiveLimit) {
      const retryAfterSeconds = Math.ceil(
        ((currentMinute + 1) * 60000 - Date.now()) / 1000
      );
      return {
        allowed: false,
        remaining: 0,
        limit: effectiveLimit,
        resetAt,
        retryAfterSeconds: Math.max(1, retryAfterSeconds),
      };
    }

    if (config.tokensPerMinute) {
      const effectiveTokenLimit = Math.floor(
        config.tokensPerMinute * 2 * burst
      );
      if (totalTokens >= effectiveTokenLimit) {
        const retryAfterSeconds = Math.ceil(
          ((currentMinute + 1) * 60000 - Date.now()) / 1000
        );
        return {
          allowed: false,
          remaining: 0,
          limit: effectiveLimit,
          resetAt,
          retryAfterSeconds: Math.max(1, retryAfterSeconds),
        };
      }
    }

    return {
      allowed: true,
      remaining,
      limit: effectiveLimit,
      resetAt,
    };
  }

  return {
    check(key: string, config: RateLimitConfig): RateLimitResult {
      return checkLimit(key, config);
    },

    consume(
      key: string,
      config: RateLimitConfig,
      requestCount = 1,
      tokenCount = 0
    ): RateLimitResult {
      const result = checkLimit(key, config);
      if (!result.allowed) return result;

      const currentMinute = getCurrentMinute();
      upsertWindowStmt.run(key, currentMinute, requestCount, tokenCount);

      return {
        ...result,
        remaining: Math.max(0, result.remaining - requestCount),
      };
    },

    cleanup(): void {
      const cutoff = getCurrentMinute() - 5;
      cleanupStmt.run(cutoff);
    },
  };
}
