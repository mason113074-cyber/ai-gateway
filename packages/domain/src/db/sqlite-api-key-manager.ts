import crypto from "node:crypto";
import type { RawDatabase } from "./connection.js";
import type {
  ApiKeyManager,
  ApiKeyRecord,
  CreateKeyInput,
  CreateKeyResult,
} from "../api-key-manager.js";

const KEY_PREFIX = "gw-";
const KEY_RANDOM_BYTES = 16;

function generateRawKey(): string {
  return KEY_PREFIX + crypto.randomBytes(KEY_RANDOM_BYTES).toString("hex");
}

function hashKey(rawKey: string): string {
  return crypto.createHash("sha256").update(rawKey).digest("hex");
}

function toRecord(row: {
  id: string;
  workspace_id: string;
  user_id: string | null;
  team_id: string | null;
  name: string;
  key_prefix: string;
  permissions: string;
  allowed_models: string | null;
  rate_limit: number | null;
  expires_at: string | null;
  last_used_at: string | null;
  created_at: string;
  key_hash?: string;
}): ApiKeyRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    userId: row.user_id,
    teamId: row.team_id,
    name: row.name,
    keyPrefix: row.key_prefix,
    permissions: JSON.parse(row.permissions) as string[],
    allowedModels: row.allowed_models ? (JSON.parse(row.allowed_models) as string[]) : null,
    rateLimit: row.rate_limit,
    expiresAt: row.expires_at,
    lastUsedAt: row.last_used_at,
    createdAt: row.created_at,
  };
}

export function createSqliteApiKeyManager(raw: RawDatabase): ApiKeyManager {
  return {
    create(workspaceId: string, input: CreateKeyInput): CreateKeyResult {
      const rawKey = generateRawKey();
      const keyHash = hashKey(rawKey);
      const keyPrefix = rawKey.slice(0, 8);
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const permissions = JSON.stringify(input.permissions);
      const allowedModels = input.allowedModels
        ? JSON.stringify(input.allowedModels)
        : null;
      raw
        .prepare(
          `INSERT INTO api_keys (id, workspace_id, user_id, team_id, name, key_hash, key_prefix, permissions, allowed_models, rate_limit, expires_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          id,
          workspaceId,
          input.userId ?? null,
          input.teamId ?? null,
          input.name,
          keyHash,
          keyPrefix,
          permissions,
          allowedModels,
          input.rateLimit ?? null,
          input.expiresAt ?? null,
          now
        );
      const row = raw
        .prepare(
          "SELECT id, workspace_id, user_id, team_id, name, key_prefix, permissions, allowed_models, rate_limit, expires_at, last_used_at, created_at FROM api_keys WHERE id = ?"
        )
        .get(id) as {
        id: string;
        workspace_id: string;
        user_id: string | null;
        team_id: string | null;
        name: string;
        key_prefix: string;
        permissions: string;
        allowed_models: string | null;
        rate_limit: number | null;
        expires_at: string | null;
        last_used_at: string | null;
        created_at: string;
      };
      const record = toRecord(row);
      return { record, rawKey };
    },

    list(workspaceId: string): ApiKeyRecord[] {
      const rows = raw
        .prepare(
          "SELECT id, workspace_id, user_id, team_id, name, key_prefix, permissions, allowed_models, rate_limit, expires_at, last_used_at, created_at FROM api_keys WHERE workspace_id = ?"
        )
        .all(workspaceId) as Array<{
        id: string;
        workspace_id: string;
        user_id: string | null;
        team_id: string | null;
        name: string;
        key_prefix: string;
        permissions: string;
        allowed_models: string | null;
        rate_limit: number | null;
        expires_at: string | null;
        last_used_at: string | null;
        created_at: string;
      }>;
      return rows.map((r) => toRecord(r));
    },

    revoke(workspaceId: string, keyId: string): boolean {
      const result = raw
        .prepare("DELETE FROM api_keys WHERE id = ? AND workspace_id = ?")
        .run(keyId, workspaceId);
      return result.changes > 0;
    },

    update(
      workspaceId: string,
      keyId: string,
      patch: Partial<
        Pick<CreateKeyInput, "name" | "permissions" | "allowedModels" | "rateLimit">
      >
    ): ApiKeyRecord | null {
      const row = raw
        .prepare(
          "SELECT id, workspace_id, user_id, team_id, name, key_prefix, permissions, allowed_models, rate_limit, expires_at, last_used_at, created_at FROM api_keys WHERE id = ? AND workspace_id = ?"
        )
        .get(keyId, workspaceId) as {
        id: string;
        workspace_id: string;
        user_id: string | null;
        team_id: string | null;
        name: string;
        key_prefix: string;
        permissions: string;
        allowed_models: string | null;
        rate_limit: number | null;
        expires_at: string | null;
        last_used_at: string | null;
        created_at: string;
      } | undefined;
      if (!row) return null;
      const name = patch.name ?? row.name;
      const permissions = patch.permissions
        ? JSON.stringify(patch.permissions)
        : row.permissions;
      const allowedModels = patch.allowedModels !== undefined
        ? JSON.stringify(patch.allowedModels)
        : row.allowed_models;
      const rateLimit = patch.rateLimit !== undefined ? patch.rateLimit : row.rate_limit;
      raw
        .prepare(
          "UPDATE api_keys SET name = ?, permissions = ?, allowed_models = ?, rate_limit = ? WHERE id = ? AND workspace_id = ?"
        )
        .run(name, permissions, allowedModels, rateLimit, keyId, workspaceId);
      const updated = raw
        .prepare(
          "SELECT id, workspace_id, user_id, team_id, name, key_prefix, permissions, allowed_models, rate_limit, expires_at, last_used_at, created_at FROM api_keys WHERE id = ?"
        )
        .get(keyId) as {
        id: string;
        workspace_id: string;
        user_id: string | null;
        team_id: string | null;
        name: string;
        key_prefix: string;
        permissions: string;
        allowed_models: string | null;
        rate_limit: number | null;
        expires_at: string | null;
        last_used_at: string | null;
        created_at: string;
      };
      return toRecord(updated);
    },

    lookupByKey(rawKey: string): ApiKeyRecord | null {
      if (!rawKey.startsWith(KEY_PREFIX)) return null;
      const keyHash = hashKey(rawKey);
      const row = raw
        .prepare(
          "SELECT id, workspace_id, user_id, team_id, name, key_hash, key_prefix, permissions, allowed_models, rate_limit, expires_at, last_used_at, created_at FROM api_keys WHERE key_hash = ?"
        )
        .get(keyHash) as {
        id: string;
        workspace_id: string;
        user_id: string | null;
        team_id: string | null;
        name: string;
        key_hash: string;
        key_prefix: string;
        permissions: string;
        allowed_models: string | null;
        rate_limit: number | null;
        expires_at: string | null;
        last_used_at: string | null;
        created_at: string;
      } | undefined;
      if (!row) return null;
      if (row.expires_at && new Date(row.expires_at) < new Date()) return null;
      return toRecord(row);
    },

    updateLastUsed(keyId: string): void {
      const now = new Date().toISOString();
      raw.prepare("UPDATE api_keys SET last_used_at = ? WHERE id = ?").run(now, keyId);
    },
  };
}
