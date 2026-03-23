import * as fs from "node:fs";
import * as path from "node:path";
import BetterSqlite3 from "better-sqlite3";
import { drizzle as drizzleSqlite } from "drizzle-orm/better-sqlite3";
import { Pool } from "pg";
import { drizzle as drizzlePg } from "drizzle-orm/pg";
import * as sqliteSchema from "./sqlite_schema.js";
import * as pgSchema from "./pg_schema.js";

export type Database = ReturnType<typeof drizzleSqlite<typeof sqliteSchema>> | ReturnType<typeof drizzlePg<typeof pgSchema>>;
export type RawDatabase = InstanceType<typeof BetterSqlite3> | Pool;

export function createDatabase(dbPath: string = "./data/gateway.db"): Database {
  if (process.env.DATABASE_URL) {
    return createPostgresDatabase(process.env.DATABASE_URL);
  }
  const { db } = createDatabaseWithRaw(dbPath);
  return db;
}

export function createPostgresDatabase(connectionString: string): Database {
  const pool = new Pool({
    connectionString,
  });
  return drizzlePg(pool, { schema: pgSchema });
}

export function createDatabaseWithRaw(
  dbPath: string = "./data/gateway.db"
): { db: Database; raw: RawDatabase } {
  const dir = path.dirname(dbPath);
  fs.mkdirSync(dir, { recursive: true });
  const sqlite = new BetterSqlite3(dbPath);
  sqlite.pragma("journal_mode = WAL");



  return { db: drizzleSqlite(sqlite, { schema: sqliteSchema }), raw: sqlite };
}
