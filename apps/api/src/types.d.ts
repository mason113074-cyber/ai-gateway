/**
 * Extend FastifyRequest with scaffold request context.
 * Used by auth middleware and session route.
 */
declare module "fastify" {
  interface FastifyRequest {
    workspaceId?: string;
    userId?: string;
  }
}
