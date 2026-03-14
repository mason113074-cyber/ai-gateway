import type { ApiKeyManager, ApiKeyRecord } from "@agent-control-tower/domain";

/** Returns an ApiKeyManager that never finds a key (legacy header auth only). For tests. */
export function createLegacyOnlyApiKeyManager(): ApiKeyManager {
  return {
    create: () => ({ record: {} as ApiKeyRecord, rawKey: "" }),
    list: () => [],
    revoke: () => true,
    update: () => null,
    lookupByKey: () => null,
    updateLastUsed: () => {},
  };
}

export type AuthRequest = {
  headers: Record<string, string | string[] | undefined>;
  workspaceId?: string;
  userId?: string;
  teamId?: string;
  permissions?: string[];
  allowedModels?: string[] | null;
  userRole?: string;
};

export type AuditLogFn = (
  workspaceId: string,
  event: { eventType: string; actorType: string; actorId: string; [k: string]: unknown }
) => void;

function getApiKeyFromRequest(request: { headers: Record<string, string | string[] | undefined> }): string | null {
  const auth = request.headers["authorization"];
  if (typeof auth === "string" && auth.startsWith("Bearer ")) {
    const key = auth.slice(7).trim();
    if (key.length > 0) return key;
  }
  const xKey = request.headers["x-api-key"];
  if (typeof xKey === "string" && xKey.length > 0) return xKey;
  return null;
}

export function createAuthMiddleware(
  apiKeyManager: ApiKeyManager,
  options?: { auditLog?: AuditLogFn }
) {
  const auditLog = options?.auditLog;

  return async function authMiddleware(
    request: AuthRequest,
    reply: { status: (code: number) => { send: (body: unknown) => void } }
  ): Promise<void> {
    const rawKey = getApiKeyFromRequest(request);
    if (rawKey) {
      const record = apiKeyManager.lookupByKey(rawKey);
      if (!record) {
        if (auditLog) {
          auditLog("unknown", {
            eventType: "auth.invalid_key",
            actorType: "api_key",
            actorId: "unknown",
            outcome: "denied",
          });
        }
        reply.status(401).send({
          error: "Invalid API key",
          message: "The provided API key is invalid or expired.",
        });
        return;
      }
      apiKeyManager.updateLastUsed(record.id);
      request.workspaceId = record.workspaceId;
      request.userId = record.userId ?? undefined;
      request.teamId = record.teamId ?? undefined;
      request.permissions = record.permissions;
      request.allowedModels = record.allowedModels;
      request.userRole = "viewer";
      return;
    }
    const workspaceId = request.headers["x-workspace-id"];
    const userId = request.headers["x-user-id"];
    request.workspaceId = typeof workspaceId === "string" ? workspaceId : undefined;
    request.userId = typeof userId === "string" ? userId : undefined;
    request.teamId = undefined;
    request.permissions = ["admin"];
    request.allowedModels = null;
    request.userRole = "owner";
  };
}

export function registerAuthMiddleware(
  app: { addHook: (name: string, fn: (req: AuthRequest, reply: unknown) => Promise<void>) => void },
  apiKeyManager: ApiKeyManager,
  options?: { auditLog?: AuditLogFn }
): void {
  const middleware = createAuthMiddleware(apiKeyManager, options);
  app.addHook("preHandler", async (request: AuthRequest, reply: unknown) => {
    await middleware(request, reply as { status: (code: number) => { send: (body: unknown) => void } });
  });
}
