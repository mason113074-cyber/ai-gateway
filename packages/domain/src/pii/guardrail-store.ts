import { eq, and } from "drizzle-orm";
import type { Database } from "../db/connection.js";
import { guardrailConfigs } from "../db/schema.js";
import type { PiiDetectorConfig, PiiType } from "./detector.js";

export interface GuardrailConfig {
  id: string;
  workspaceId: string;
  type: string;
  config: PiiDetectorConfig;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GuardrailStore {
  get(workspaceId: string, type: string): GuardrailConfig | null;
  upsert(
    workspaceId: string,
    type: string,
    config: PiiDetectorConfig,
    enabled?: boolean
  ): GuardrailConfig;
  list(workspaceId: string): GuardrailConfig[];
  setEnabled(
    workspaceId: string,
    id: string,
    enabled: boolean
  ): GuardrailConfig | null;
}

function rowToConfig(row: {
  id: string;
  workspaceId: string;
  type: string;
  config: string;
  enabled: number;
  createdAt: string;
  updatedAt: string;
}): GuardrailConfig {
  const parsed = JSON.parse(row.config) as {
    enabledTypes: PiiType[];
    action: "redact" | "warn" | "block";
  };
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    type: row.type,
    config: parsed,
    enabled: row.enabled !== 0,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function createSqliteGuardrailStore(db: Database): GuardrailStore {
  return {
    get(workspaceId: string, type: string): GuardrailConfig | null {
      const row = db
        .select()
        .from(guardrailConfigs)
        .where(
          and(
            eq(guardrailConfigs.workspaceId, workspaceId),
            eq(guardrailConfigs.type, type)
          )
        )
        .get();
      if (!row) return null;
      return rowToConfig(row);
    },

    upsert(
      workspaceId: string,
      type: string,
      config: PiiDetectorConfig,
      enabled: boolean = true
    ): GuardrailConfig {
      const id = `${workspaceId}:${type}`;
      const now = new Date().toISOString();
      const configJson = JSON.stringify({
        enabledTypes: config.enabledTypes,
        action: config.action,
      });

      db.insert(guardrailConfigs)
        .values({
          id,
          workspaceId,
          type,
          config: configJson,
          enabled: enabled ? 1 : 0,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: guardrailConfigs.id,
          set: {
            config: configJson,
            enabled: enabled ? 1 : 0,
            updatedAt: now,
          },
        })
        .run();

      return {
        id,
        workspaceId,
        type,
        config,
        enabled,
        createdAt: now,
        updatedAt: now,
      };
    },

    list(workspaceId: string): GuardrailConfig[] {
      const rows = db
        .select()
        .from(guardrailConfigs)
        .where(eq(guardrailConfigs.workspaceId, workspaceId))
        .all();
      return rows.map(rowToConfig);
    },

    setEnabled(
      workspaceId: string,
      id: string,
      enabled: boolean
    ): GuardrailConfig | null {
      const row = db
        .select()
        .from(guardrailConfigs)
        .where(
          and(
            eq(guardrailConfigs.id, id),
            eq(guardrailConfigs.workspaceId, workspaceId)
          )
        )
        .get();
      if (!row) return null;

      db.update(guardrailConfigs)
        .set({ enabled: enabled ? 1 : 0, updatedAt: new Date().toISOString() })
        .where(
          and(
            eq(guardrailConfigs.id, id),
            eq(guardrailConfigs.workspaceId, workspaceId)
          )
        )
        .run();

      return rowToConfig({
        ...row,
        enabled: enabled ? 1 : 0,
        updatedAt: new Date().toISOString(),
      });
    },
  };
}

/** Get PII config for a workspace, falling back to defaults if not configured */
export function getPiiConfig(
  store: GuardrailStore,
  workspaceId: string
): PiiDetectorConfig & { enabled: boolean } {
  const config = store.get(workspaceId, "pii_redaction");
  if (!config) {
    return {
      enabledTypes: ["email", "phone", "ssn", "credit_card", "api_key"],
      action: "warn",
      enabled: false,
    };
  }
  return { ...config.config, enabled: config.enabled };
}
