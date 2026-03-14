export interface ApiKeyRecord {
  id: string;
  workspaceId: string;
  userId: string | null;
  teamId: string | null;
  name: string;
  keyPrefix: string;
  permissions: string[];
  allowedModels: string[] | null;
  rateLimit: number | null;
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
}

export interface CreateKeyInput {
  name: string;
  userId?: string;
  teamId?: string;
  permissions: string[];
  allowedModels?: string[];
  rateLimit?: number;
  expiresAt?: string;
}

export interface CreateKeyResult {
  record: ApiKeyRecord;
  rawKey: string;
}

export interface ApiKeyManager {
  create(workspaceId: string, input: CreateKeyInput): CreateKeyResult;
  list(workspaceId: string): ApiKeyRecord[];
  revoke(workspaceId: string, keyId: string): boolean;
  update(
    workspaceId: string,
    keyId: string,
    patch: Partial<
      Pick<
        CreateKeyInput,
        "name" | "permissions" | "allowedModels" | "rateLimit"
      >
    >
  ): ApiKeyRecord | null;
  lookupByKey(rawKey: string): ApiKeyRecord | null;
  updateLastUsed(keyId: string): void;
}
