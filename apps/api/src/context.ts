/**
 * Request context attached by auth middleware (T001 scaffold).
 * Placeholder only — not for production authorization.
 */
export interface RequestContext {
  workspaceId: string | undefined;
  userId: string | undefined;
}
