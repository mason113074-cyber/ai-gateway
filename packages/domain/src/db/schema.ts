import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  email: text("email").notNull(),
  name: text("name"),
  role: text("role").notNull().default("viewer"),
  createdAt: text("created_at").notNull(),
  lastLoginAt: text("last_login_at"),
});

export const apiKeys = sqliteTable("api_keys", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  userId: text("user_id"),
  teamId: text("team_id"),
  name: text("name").notNull(),
  keyHash: text("key_hash").notNull(),
  keyPrefix: text("key_prefix").notNull(),
  permissions: text("permissions").notNull(),
  allowedModels: text("allowed_models"),
  rateLimit: integer("rate_limit"),
  expiresAt: text("expires_at"),
  lastUsedAt: text("last_used_at"),
  createdAt: text("created_at").notNull(),
});
