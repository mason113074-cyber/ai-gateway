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
    CREATE TABLE IF NOT EXISTS team_budgets (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      team_id TEXT NOT NULL,
      monthly_budget_usd REAL NOT NULL,
      current_spend_usd REAL NOT NULL DEFAULT 0,
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL,
      hard_cap INTEGER NOT NULL DEFAULT 1,
      alert_threshold_pct INTEGER NOT NULL DEFAULT 80,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS agent_budgets (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      agent_id TEXT NOT NULL,
      daily_budget_usd REAL NOT NULL,
      current_spend_usd REAL NOT NULL DEFAULT 0,
      period_start TEXT NOT NULL,
      hard_cap INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
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
