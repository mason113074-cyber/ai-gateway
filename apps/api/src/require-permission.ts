import { hasPermission } from "@agent-control-tower/domain";

export type RequestWithAuth = {
  userRole?: string;
  permissions?: string[];
};

export type ReplyWithSent = {
  sent: boolean;
  status: (code: number) => { send: (body: unknown) => void };
};

export function requirePermission(permission: string) {
  return async function (request: RequestWithAuth, reply: ReplyWithSent): Promise<void> {
    const userRole = request.userRole ?? "viewer";
    const keyPermissions = request.permissions ?? [];
    if (hasPermission(userRole, keyPermissions, permission)) return;
    if (reply.sent) return;
    reply.status(403).send({
      error: "Insufficient permissions",
      required: permission,
      message: `This action requires '${permission}' permission`,
    });
  };
}
