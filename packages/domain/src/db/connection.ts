import * as fs from "node:fs";
import * as path from "node:path";
import BetterSqlite3 from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";

export type Database = ReturnType<typeof drizzle<typeof schema>>;
export type RawDatabase = InstanceType<typeof BetterSqlite3>;

export function createDatabase(dbPath: string = "./data/gateway.db"): Database {
  const { db } = createDatabaseWithRaw(dbPath);
  return db;
}

export function createDatabaseWithRaw(
  dbPath: string = "./data/gateway.db"
): { db: Database; raw: RawDatabase } {
  const dir = path.dirname(dbPath);
  fs.mkdirSync(dir, { recursive: true });
  const sqlite = new BetterSqlite3(dbPath);
  sqlite.pragma("journal_mode = WAL");

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      email TEXT NOT NULL,
      name TEXT,
      role TEXT NOT NULL DEFAULT 'viewer',
      created_at TEXT NOT NULL,
      last_login_at TEXT
    );
    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      user_id TEXT,
      team_id TEXT,
      name TEXT NOT NULL,
      key_hash TEXT NOT NULL,
      key_prefix TEXT NOT NULL,
      permissions TEXT NOT NULL,
      allowed_models TEXT,
      rate_limit INTEGER,
      expires_at TEXT,
      last_used_at TEXT,
      created_at TEXT NOT NULL
    );
  `);

  return { db: drizzle(sqlite, { schema }), raw: sqlite };
}
