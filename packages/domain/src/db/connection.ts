import * as fs from "node:fs";
import * as path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

export type Database = ReturnType<typeof drizzle<typeof schema>>;

export function createDatabase(dbPath: string = "./data/gateway.db"): Database {
  const dir = path.dirname(dbPath);
  fs.mkdirSync(dir, { recursive: true });
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");

  // Create tables from schema (Drizzle push equivalent for first run)
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS proxy_logs (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      workspace_id TEXT NOT NULL DEFAULT 'default',
      agent_id TEXT NOT NULL,
      team_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      request_tokens INTEGER,
      response_tokens INTEGER,
      total_tokens INTEGER,
      latency_ms INTEGER NOT NULL,
      status_code INTEGER NOT NULL,
      cost_usd REAL,
      error TEXT
    );
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL DEFAULT 'default',
      name TEXT NOT NULL,
      owner TEXT,
      sponsor TEXT,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      allowed_tools TEXT,
      allowed_data_scopes TEXT,
      auto_registered INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      last_seen_at TEXT
    );
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      workspace_id TEXT NOT NULL DEFAULT 'default',
      event_type TEXT NOT NULL,
      actor_type TEXT NOT NULL,
      actor_id TEXT NOT NULL,
      target_type TEXT,
      target_id TEXT,
      action TEXT NOT NULL,
      outcome TEXT NOT NULL,
      metadata TEXT
    );
  `);

  return drizzle(sqlite, { schema });
}
