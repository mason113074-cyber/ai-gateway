import type {
  ApiKeyManager,
  Database,
  AgentRegistry,
  AuditLogger,
  BudgetManager,
  GuardrailStore,
  LogStore,
  RateLimiter,
  RateLimitConfigStore,
} from "@agent-control-tower/domain";

export type AppRouteDeps = {
  db: Database;
  agentRegistry: AgentRegistry;
  auditLogger: AuditLogger;
  budgetManager: BudgetManager;
  guardrailStore: GuardrailStore;
  rateLimiter: RateLimiter;
  rateLimitConfigStore: RateLimitConfigStore;
  logStore: LogStore;
  apiKeyManager: ApiKeyManager;
};
