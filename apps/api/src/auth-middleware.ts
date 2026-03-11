/**
 * Auth middleware placeholder (T001 scaffold).
 * Reads x-workspace-id and x-user-id and attaches to request.
 * NOT for production — scaffold only.
 */
type PreHandlerRequest = {
  headers: Record<string, string | string[] | undefined>;
  workspaceId?: string;
  userId?: string;
};

export async function authMiddleware(
  request: PreHandlerRequest,
  _reply: unknown,
) {
  const workspaceId = request.headers["x-workspace-id"];
  const userId = request.headers["x-user-id"];
  request.workspaceId =
    typeof workspaceId === "string" ? workspaceId : undefined;
  request.userId = typeof userId === "string" ? userId : undefined;
}

export function registerAuthMiddleware(app: { addHook: (name: string, fn: (req: PreHandlerRequest, reply: unknown) => Promise<void>) => void }) {
  app.addHook("preHandler", authMiddleware);
}
