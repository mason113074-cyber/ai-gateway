import "dotenv/config";
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
  getPiiConfig,
  createSlidingWindowRateLimiter,
  createSqliteRateLimitConfigStore,
} from "@agent-control-tower/domain";
import { registerAuthMiddleware } from "./auth-middleware.js";
import { registerProxyRoutes } from "./proxy.js";
import { registerRestRoutes } from "./routes/index.js";
import type { AppRouteDeps } from "./routes/deps.js";

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

await app.register(async (proxyScope: ProxyScopeLike) => {
  proxyScope.addContentTypeParser(
    "application/json",
    { parseAs: "string", bodyLimit: 10485760 },
    (_req: unknown, body: string, done: (err: Error | null, body?: string) => void) => {
      done(null, body);
    }
  );
  registerProxyRoutes(proxyScope as Parameters<typeof registerProxyRoutes>[0], agentRegistry, logStore, budgetManager, auditLogger, {
    getPiiConfig: (workspaceId) => getPiiConfig(guardrailStore, workspaceId),
    getRateLimitConfig: (workspaceId, teamId, agentId) =>
      rateLimitConfigStore.getEffectiveConfig(workspaceId, teamId, agentId),
    rateLimiter,
  });
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
app.listen({ port, host: "0.0.0.0" }).catch((error: unknown) => {
  app.log.error(error);
  process.exit(1);
});
