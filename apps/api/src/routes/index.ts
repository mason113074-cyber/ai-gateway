import type { FastifyInstance } from "fastify/types/instance";
import type { AppRouteDeps } from "./deps.js";
import type { RouteApp } from "./route-app.js";
import { registerAgentRoutes } from "./agents.js";
import { registerAuditRoutes } from "./audit.js";
import { registerBudgetRoutes } from "./budgets.js";
import { registerCostRoutes } from "./costs.js";
import { registerGuardrailRoutes } from "./guardrails.js";
import { registerHealthRoutes } from "./health.js";
import { registerKeyRoutes } from "./keys.js";
import { registerLogRoutes } from "./logs.js";
import { registerPolicyRoutes } from "./policy.js";
import { registerRateLimitRoutes } from "./rate-limits.js";
import { registerSessionRoutes } from "./session.js";
import { registerStatsRoutes } from "./stats.js";

export function registerRestRoutes(app: FastifyInstance, deps: AppRouteDeps): void {
  const r = app as unknown as RouteApp;
  registerHealthRoutes(r);
  registerSessionRoutes(r);
  registerAgentRoutes(r, deps);
  registerAuditRoutes(r, deps);
  registerGuardrailRoutes(r, deps);
  registerRateLimitRoutes(r, deps);
  registerLogRoutes(r, deps);
  registerStatsRoutes(r, deps);
  registerBudgetRoutes(r, deps);
  registerCostRoutes(r, deps);
  registerPolicyRoutes(r);
  registerKeyRoutes(r, deps);
}
