import path from "node:path";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify/types/instance";
import cors from "@fastify/cors";
import {
  createDatabaseWithRaw,
  createLogStore,
  createAgentRegistry,
  createAuditLogger,
  createBudgetManager,
  createSqliteApiKeyManager,
  createGuardrailStore,
  createSlidingWindowRateLimiter,
  createSqliteRateLimitConfigStore,
} from "@agent-control-tower/domain";
import { registerAuthMiddleware } from "./auth-middleware.js";
import { registerProxyPlugin } from "./routes/register-proxy.js";
import { registerRestRoutes } from "./routes/index.js";
import type { AppRouteDeps } from "./routes/deps.js";

type FastifyLike = FastifyInstance & {
  register: (plugin: unknown, opts?: unknown) => Promise<void>;
};

/**
 * Wires SQLite stores, auth, `/v1/*` proxy (`routes/register-proxy.ts`), and REST routes (`routes/index.ts`).
 * Kept out of `server.ts` so the entrypoint stays a one-liner.
 */
export async function startGatewayServer(): Promise<void> {
  const dbPath = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "gateway.db");
  const { db, raw } = createDatabaseWithRaw(dbPath);
  const logStore = createLogStore(db);
  const agentRegistry = createAgentRegistry(db);
  const auditLogger = createAuditLogger(db);
  const budgetManager = createBudgetManager(db, raw);
  const apiKeyManager = createSqliteApiKeyManager(raw);
  const guardrailStore = createGuardrailStore(db);
  const rateLimiter = createSlidingWindowRateLimiter(raw);
  const rateLimitConfigStore = createSqliteRateLimitConfigStore(raw);

  setInterval(() => rateLimiter.cleanup(), 5 * 60 * 1000);

  const createApp = Fastify as unknown as (opts?: { logger?: boolean }) => FastifyLike;
  const app = createApp({ logger: true });
  await app.register(cors, { origin: true });

  registerAuthMiddleware(
    app as unknown as Parameters<typeof registerAuthMiddleware>[0],
    apiKeyManager,
    {
      auditLog: async (workspaceId, event) => {
        await auditLogger.log(workspaceId, {
          eventType: event.eventType,
          actorType:
            event.actorType === "agent" || event.actorType === "user"
              ? event.actorType
              : "system",
          actorId: event.actorId,
          action: "auth",
          outcome:
            event.outcome === "success" || event.outcome === "error"
              ? event.outcome
              : "denied",
        });
      },
    }
  );

  await registerProxyPlugin(app, {
    agentRegistry,
    logStore,
    budgetManager,
    auditLogger,
    guardrailStore,
    rateLimiter,
    rateLimitConfigStore,
  });

  const routeDeps: AppRouteDeps = {
    db,
    agentRegistry,
    auditLogger,
    budgetManager,
    guardrailStore,
    rateLimiter,
    rateLimitConfigStore,
    logStore,
    apiKeyManager,
  };

  registerRestRoutes(app, routeDeps);

  const port = Number(process.env.PORT ?? 4000);
  try {
    await app.listen({ port, host: "0.0.0.0" });
  } catch (error: unknown) {
    app.log.error(error);
    process.exit(1);
  }
}
