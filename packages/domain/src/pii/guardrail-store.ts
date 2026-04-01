import { eq, and } from "drizzle-orm";
import type { Database } from "../db/connection.js";
import schema from "../db/schema.js";
import type { PiiDetectorConfig, PiiType } from "./detector.js";

const { guardrailConfigs } = schema;

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
  get(workspaceId: string, type: string): GuardrailConfig | null | Promise<GuardrailConfig | null>;
  upsert(
    workspaceId: string,
    type: string,
    config: PiiDetectorConfig,
    enabled?: boolean
  ): GuardrailConfig | Promise<GuardrailConfig>;
  list(workspaceId: string): GuardrailConfig[] | Promise<GuardrailConfig[]>;
  setEnabled(
    workspaceId: string,
    id: string,
    enabled: boolean
  ): GuardrailConfig | null | Promise<GuardrailConfig | null>;
}

function rowToConfig(row: any): GuardrailConfig {
  const parsed = typeof row.config === 'string' ? JSON.parse(row.config) : row.config;
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    type: row.type,
    config: parsed,
    enabled: row.enabled !== 0,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt,
  };
}

export function createGuardrailStore(db: Database): GuardrailStore {
  const now = () => new Date().toISOString();

  return {
    async get(workspaceId: string, type: string): Promise<GuardrailConfig | null> {
      const query = db
        .select()
        .from(guardrailConfigs)
        .where(
          and(
            eq(guardrailConfigs.workspaceId, workspaceId),
            eq(guardrailConfigs.type, type)
          )
        );
      const row = (query as any).get();
      if (!row) return null;
      return rowToConfig(row);
    },

    async upsert(
      workspaceId: string,
      type: string,
      config: PiiDetectorConfig,
      enabled: boolean = true
    ): Promise<GuardrailConfig> {
      const id = `${workspaceId}:${type}`;
      const currentTime = now();
      const configJson = JSON.stringify({
        enabledTypes: config.enabledTypes,
        action: config.action,
      });

      const values = {
        id,
        workspaceId,
        type,
        config: configJson,
        enabled: enabled ? 1 : 0,
        createdAt: currentTime,
        updatedAt: currentTime,
      };

      (db as any)
        .insert(guardrailConfigs)
        .values(values)
        .onConflictDoUpdate({
          target: guardrailConfigs.id,
          set: {
            config: configJson,
            enabled: enabled ? 1 : 0,
            updatedAt: currentTime,
          },
        })
        .run();

      return {
        id,
        workspaceId,
        type,
        config,
        enabled,
        createdAt: currentTime,
        updatedAt: currentTime,
      };
    },

    async list(workspaceId: string): Promise<GuardrailConfig[]> {
      const query = db
        .select()
        .from(guardrailConfigs)
        .where(eq(guardrailConfigs.workspaceId, workspaceId));
      const rows = (query as any).all();
      return rows.map(rowToConfig);
    },

    async setEnabled(
      workspaceId: string,
      id: string,
      enabled: boolean
    ): Promise<GuardrailConfig | null> {
      const existing = await this.get(workspaceId, id);
      if (!existing) return null;

      const currentTime = now();
      const updateQuery = db.update(guardrailConfigs)
        .set({ enabled: enabled ? 1 : 0, updatedAt: currentTime })
        .where(
          and(
            eq(guardrailConfigs.id, id),
            eq(guardrailConfigs.workspaceId, workspaceId)
          )
        );
      
      (updateQuery as any).run();

      return {
        ...existing,
        enabled,
        updatedAt: currentTime,
      };
    },
  };
}

/** Get PII config for a workspace, falling back to defaults if not configured */
export async function getPiiConfig(
  store: GuardrailStore,
  workspaceId: string
): Promise<PiiDetectorConfig & { enabled: boolean }> {
  const config = await store.get(workspaceId, "pii_redaction");
  if (!config) {
    return {
      enabledTypes: ["email", "phone", "ssn", "credit_card", "api_key"],
      action: "warn",
      enabled: false,
    };
  }
  return { ...config.config, enabled: config.enabled };
}
