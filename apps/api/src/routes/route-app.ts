/**
 * Loose surface for registering REST routes — matches the pre-refactor `FastifyLike` pattern.
 * Fastify's strict RouteHandler generics fight our auth-enriched request shapes; behavior is unchanged.
 */
export type RouteApp = {
  get: (...args: unknown[]) => void;
  post: (...args: unknown[]) => void;
  patch: (...args: unknown[]) => void;
  delete: (...args: unknown[]) => void;
};
