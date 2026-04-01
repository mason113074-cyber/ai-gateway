import { describe, expect, it } from "vitest";
import {
  createDatabaseWithRaw,
  POSTGRES_UNSUPPORTED_MESSAGE,
} from "./connection.js";

describe("database connection", () => {
  it("fails closed when DATABASE_URL is set", () => {
    const prevDatabaseUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = "postgres://user:pass@localhost:5432/db";

    try {
      expect(() => createDatabaseWithRaw(":memory:")).toThrow(
        POSTGRES_UNSUPPORTED_MESSAGE
      );
    } finally {
      if (prevDatabaseUrl === undefined) {
        delete process.env.DATABASE_URL;
      } else {
        process.env.DATABASE_URL = prevDatabaseUrl;
      }
    }
  });
});
