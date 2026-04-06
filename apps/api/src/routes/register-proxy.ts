import type { FastifyInstance } from "fastify/types/instance";
import { getPiiConfig } from "@agent-control-tower/domain";
import { registerProxyRoutes } from "../proxy.js";
import type { AppRouteDeps } from "./deps.js";

type FastifyLike = FastifyInstance & {
  register: (plugin: unknown, opts?: unknown) => Promise<void>;
};

type ProxyScopeLike = Parameters<typeof registerProxyRoutes>[0] & {
  addContentTypeParser: (
    contentType: string,
    opts: { parseAs: "string"; bodyLimit: number },
    parser: (
      req: unknown,
      body: string,
      done: (err: Error | null, body?: string) => void
    ) => void
  ) => void;
};

export type ProxyRouteDeps = Pick<
  AppRouteDeps,
  | "agentRegistry"
  | "logStore"
  | "budgetManager"
  | "auditLogger"
  | "guardrailStore"
  | "rateLimiter"
  | "rateLimitConfigStore"
>;

/**
 * Registers the `/v1/*` LLM proxy inside a scoped Fastify plugin (string JSON body parser + proxy routes).
 * Lives under `routes/` next to REST registration so HTTP surface wiring stays in one folder.
 */
export async function registerProxyPlugin(app: FastifyLike, deps: ProxyRouteDeps): Promise<void> {
  await app.register(async (proxyScope: ProxyScopeLike) => {
    proxyScope.addContentTypeParser(
      "application/json",
      { parseAs: "string", bodyLimit: 10485760 },
      (_req: unknown, body: string, done: (err: Error | null, body?: string) => void) => {
        done(null, body);
      }
    );
    registerProxyRoutes(
      proxyScope as Parameters<typeof registerProxyRoutes>[0],
      deps.agentRegistry,
      deps.logStore,
      deps.budgetManager,
      deps.auditLogger,
      {
        getPiiConfig: (workspaceId) => getPiiConfig(deps.guardrailStore, workspaceId),
        getRateLimitConfig: (workspaceId, teamId, agentId) =>
          deps.rateLimitConfigStore.getEffectiveConfig(workspaceId, teamId, agentId),
        rateLimiter: deps.rateLimiter,
      }
    );
  });
}
