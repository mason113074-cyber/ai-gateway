import { hasPermission } from "@agent-control-tower/domain";
import type { FastifyReply } from "fastify/types/reply";
import type { FastifyRequest } from "fastify/types/request";

export type RequestWithAuth = FastifyRequest & {
  workspaceId?: string;
  userId?: string;
  userRole?: string;
  permissions?: string[];
  allowedModels?: string[] | null;
};

export function requirePermission(permission: string) {
  return async function (request: RequestWithAuth, reply: FastifyReply): Promise<void> {
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
