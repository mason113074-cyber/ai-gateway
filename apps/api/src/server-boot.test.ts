import { describe, expect, it } from "vitest";
import { createDatabaseWithRaw, POSTGRES_UNSUPPORTED_MESSAGE } from "@agent-control-tower/domain";

describe("server bootstrap safety", () => {
  it("fails closed when DATABASE_URL is configured", () => {
    const prev = process.env.DATABASE_URL;
    process.env.DATABASE_URL = "postgres://u:p@localhost:5432/app";
    try {
      expect(() => createDatabaseWithRaw(":memory:")).toThrow(POSTGRES_UNSUPPORTED_MESSAGE);
    } finally {
      if (prev === undefined) {
        delete process.env.DATABASE_URL;
      } else {
        process.env.DATABASE_URL = prev;
      }
    }
  });
});
