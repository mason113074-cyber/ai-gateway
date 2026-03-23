import { request as undiciRequest } from "undici";
import {
  DEFAULT_PROVIDERS,
  evaluatePolicy,
  estimateCost,
  detectPii,
  redactRequestBody,
  extractPromptText,
  getNextProvider,
  type LogStore,
  type AgentRegistry,
  type BudgetManager,
  type AuditLogger,
  type PiiDetectorConfig,
  type RateLimitConfig,
  type RateLimiter,
} from "@agent-control-tower/domain";

interface ProxyApp {
  all(path: string, handler: (req: unknown, reply: unknown) => Promise<void>): void;
}

function getUpstreamBaseUrl(provider: string): string | null {
  const config = DEFAULT_PROVIDERS[provider as keyof typeof DEFAULT_PROVIDERS];
  return config ? config.baseUrl : null;
}

function getUpstreamApiKey(provider: string): string | null {
  const config = DEFAULT_PROVIDERS[provider as keyof typeof DEFAULT_PROVIDERS];
  if (!config) return null;
  return process.env[config.apiKeyEnvVar] ?? null;
}

export function registerProxyRoutes(
  app: ProxyApp,
  agentRegistry: AgentRegistry,
  logStore: LogStore,
  budgetManager: BudgetManager,
  auditLogger: AuditLogger,
  options?: {
    getPiiConfig?: (
      workspaceId: string
    ) => PiiDetectorConfig & { enabled: boolean };
    getRateLimitConfig?: (
      workspaceId: string,
      teamId: string,
      agentId: string
    ) => {
      teamConfig: RateLimitConfig | null;
      agentConfig: RateLimitConfig | null;
      globalConfig: RateLimitConfig | null;
    };
    rateLimiter?: RateLimiter;
  }
): void {
  app.all("/v1/*", async (req: unknown, reply: unknown) => {
    const req_ = req as {
      headers: Record<string, string | string[] | undefined>;
      params?: { "*"?: string };
      method: string;
      raw?: { body?: { text: () => Promise<string> } };
      workspaceId?: string;
      allowedModels?: string[] | null;
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reply_ = reply as any;
    const startTime = Date.now();
    const agentId = (req_.headers["x-agent-id"] as string) ?? "anonymous";
    const teamId = (req_.headers["x-team-id"] as string) ?? "default";
    const provider = (req_.headers["x-provider"] as string) ?? "openai";
    const workspaceId = (req as { workspaceId?: string }).workspaceId ?? "default";

    await agentRegistry.ensureExists(workspaceId, agentId);

    const baseUrl = getUpstreamBaseUrl(provider);
    const apiKey = getUpstreamApiKey(provider);
    if (!baseUrl) {
      await auditLogger.log(workspaceId, {
        eventType: "proxy.request",
        actorType: "agent",
        actorId: agentId,
        targetType: "model",
        action: "proxy",
        outcome: "error",
        metadata: { error: "Unknown provider", provider },
      });
      return reply_.status(404).send({ error: "Unknown provider", provider });
    }
    if (!apiKey) {
      await auditLogger.log(workspaceId, {
        eventType: "proxy.request",
        actorType: "agent",
        actorId: agentId,
        targetType: "model",
        action: "proxy",
        outcome: "error",
        metadata: { error: "Upstream API key not configured", provider },
      });
      return reply_.status(502).send({
        error: "Upstream API key not configured",
        provider,
      });
    }

    const pathSeg = req_.params?.["*"] ?? "";
    const upstreamUrl = `${baseUrl.replace(/\/$/, "")}/v1/${pathSeg}`;
    let body: string | undefined;
    let model = "unknown";
    try {
      const rawBody = req_.raw?.body;
      if (rawBody && typeof rawBody.text === "function") {
        body = await rawBody.text();
        try {
          const parsed = JSON.parse(body) as { model?: string };
          if (parsed.model) model = parsed.model;
        } catch {
          // ignore
        }
      }
    } catch {
      // no body
    }

    const decision = evaluatePolicy({
      actionType: "write",
      target: model,
      external: true,
    });
    if (decision.requiresApproval) {
      await auditLogger.log(workspaceId, {
        eventType: "policy.requires_approval",
        actorType: "agent",
        actorId: agentId,
        targetType: "model",
        targetId: model,
        action: "proxy",
        outcome: "denied",
        metadata: { rationale: decision.reasons.join("; ") },
      });
      return reply_.status(403).send({
        error: "Policy denied",
        rationale: decision.reasons.join("; "),
      });
    }

    if (req_.allowedModels && Array.isArray(req_.allowedModels) && req_.allowedModels.length > 0) {
      if (!req_.allowedModels.includes(model)) {
        await auditLogger.log(workspaceId, {
          eventType: "auth.model_denied",
          actorType: "agent",
          actorId: agentId,
          targetType: "model",
          targetId: model,
          action: "proxy.request",
          outcome: "denied",
          metadata: { allowed: req_.allowedModels, requested: model },
        });
        return reply_.status(403).send({
          error: "Model not allowed",
          message: `API key is not authorized to use model '${model}'. Allowed: ${req_.allowedModels.join(", ")}`,
        });
      }
    }

    const estimatedCostUsd = estimateCost(model, 500, 500);
    const budgetCheck = await budgetManager.checkBudget(workspaceId, teamId, agentId, estimatedCostUsd);
    if (!budgetCheck.allowed) {
      await auditLogger.log(workspaceId, {
        eventType: "budget.exceeded",
        actorType: "agent",
        actorId: agentId,
        targetType: "budget",
        targetId: teamId,
        action: "proxy.request",
        outcome: "denied",
        metadata: { reason: budgetCheck.reason, estimatedCostUsd },
      });
      return reply_.status(429).send({
        error: "Budget exceeded",
        message: budgetCheck.reason,
        teamBudgetRemaining: budgetCheck.teamBudgetRemaining,
        agentBudgetRemaining: budgetCheck.agentBudgetRemaining,
      });
    }

    // ── Phase 9: Rate Limiting ────────────────────────────────
    if (options?.rateLimiter && options?.getRateLimitConfig) {
      const rlConfigs = options.getRateLimitConfig(workspaceId, teamId, agentId);

      if (rlConfigs.globalConfig) {
        const globalResult = options.rateLimiter.check(
          `global:${workspaceId}`,
          rlConfigs.globalConfig
        );
        if (!globalResult.allowed) {
          await auditLogger.log(workspaceId, {
            eventType: "rate_limit.exceeded",
            actorType: "agent",
            actorId: agentId,
            targetType: "rate_limit",
            targetId: `global:${workspaceId}`,
            action: "proxy.request",
            outcome: "denied",
            metadata: {
              remaining: globalResult.remaining,
              retryAfterSeconds: globalResult.retryAfterSeconds,
            },
          });
          return reply_
            .status(429)
            .header("Retry-After", String(globalResult.retryAfterSeconds ?? 60))
            .header("X-RateLimit-Limit", String(globalResult.limit))
            .header("X-RateLimit-Remaining", String(globalResult.remaining))
            .header("X-RateLimit-Reset", globalResult.resetAt)
            .send({
              error: "Rate limit exceeded",
              scope: "workspace",
              retryAfterSeconds: globalResult.retryAfterSeconds,
            });
        }
      }

      if (rlConfigs.teamConfig) {
        const teamResult = options.rateLimiter.check(
          `team:${workspaceId}:${teamId}`,
          rlConfigs.teamConfig
        );
        if (!teamResult.allowed) {
          await auditLogger.log(workspaceId, {
            eventType: "rate_limit.exceeded",
            actorType: "agent",
            actorId: agentId,
            targetType: "rate_limit",
            targetId: `team:${workspaceId}:${teamId}`,
            action: "proxy.request",
            outcome: "denied",
            metadata: {
              remaining: teamResult.remaining,
              retryAfterSeconds: teamResult.retryAfterSeconds,
            },
          });
          return reply_
            .status(429)
            .header("Retry-After", String(teamResult.retryAfterSeconds ?? 60))
            .header("X-RateLimit-Limit", String(teamResult.limit))
            .header("X-RateLimit-Remaining", String(teamResult.remaining))
            .header("X-RateLimit-Reset", teamResult.resetAt)
            .send({
              error: "Rate limit exceeded",
              scope: "team",
              teamId,
              retryAfterSeconds: teamResult.retryAfterSeconds,
            });
        }
      }

      if (rlConfigs.agentConfig) {
        const agentResult = options.rateLimiter.check(
          `agent:${agentId}`,
          rlConfigs.agentConfig
        );
        if (!agentResult.allowed) {
          await auditLogger.log(workspaceId, {
            eventType: "rate_limit.exceeded",
            actorType: "agent",
            actorId: agentId,
            targetType: "rate_limit",
            targetId: `agent:${agentId}`,
            action: "proxy.request",
            outcome: "denied",
            metadata: {
              remaining: agentResult.remaining,
              retryAfterSeconds: agentResult.retryAfterSeconds,
            },
          });
          return reply_
            .status(429)
            .header("Retry-After", String(agentResult.retryAfterSeconds ?? 60))
            .header("X-RateLimit-Limit", String(agentResult.limit))
            .header("X-RateLimit-Remaining", String(agentResult.remaining))
            .header("X-RateLimit-Reset", agentResult.resetAt)
            .send({
              error: "Rate limit exceeded",
              scope: "agent",
              agentId,
              retryAfterSeconds: agentResult.retryAfterSeconds,
            });
        }
      }
    }
    // ── End Rate Limiting ─────────────────────────────────────

    // ── Phase 8: PII Guardrail ─────────────────────────────
    if (body && options?.getPiiConfig) {
      const piiConfig = options.getPiiConfig(workspaceId);
      if (piiConfig.enabled) {
        const promptText = extractPromptText(body);
        const piiMatches = detectPii(promptText, piiConfig);

        if (piiMatches.length > 0) {
          const piiSummary = piiMatches.map((m) => m.type);

          if (piiConfig.action === "block") {
            auditLogger.log(workspaceId, {
              eventType: "guardrail.pii_blocked",
              actorType: "agent",
              actorId: agentId,
              targetType: "guardrail",
              targetId: "pii_redaction",
              action: "proxy.request",
              outcome: "denied",
              metadata: { piiTypes: piiSummary, count: piiMatches.length },
            });
            return reply_.status(400).send({
              error: "PII detected in prompt",
              piiTypes: piiSummary,
              message:
                "Request blocked: personally identifiable information detected. Configure redaction to auto-clean prompts.",
            });
          }

          if (piiConfig.action === "redact") {
            body = redactRequestBody(body, piiMatches);
            auditLogger.log(workspaceId, {
              eventType: "guardrail.pii_redacted",
              actorType: "system",
              actorId: "pii-guardrail",
              targetType: "guardrail",
              targetId: "pii_redaction",
              action: "redact",
              outcome: "success",
              metadata: { piiTypes: piiSummary, count: piiMatches.length },
            });
          }

          if (piiConfig.action === "warn") {
            auditLogger.log(workspaceId, {
              eventType: "guardrail.pii_warning",
              actorType: "system",
              actorId: "pii-guardrail",
              targetType: "guardrail",
              targetId: "pii_redaction",
              action: "warn",
              outcome: "success",
              metadata: { piiTypes: piiSummary, count: piiMatches.length },
            });
          }
        }
      }
    }
    // ── End PII Guardrail ──────────────────────────────────

    const headers: Record<string, string> = {
      "content-type": (req_.headers["content-type"] as string) ?? "application/json",
      authorization: (req_.headers["authorization"] as string) ?? `Bearer ${apiKey}`,
    };
    if (req_.headers["x-api-key"]) headers["x-api-key"] = req_.headers["x-api-key"] as string;

    try {
      let currentProvider = provider;
      let currentApiKey = apiKey;
      let currentUpstreamUrl = upstreamUrl;
      let res: any;
      let attempts = 0;
      const maxAttempts = 3;

      while (attempts < maxAttempts) {
        attempts++;
        res = await undiciRequest(currentUpstreamUrl, {
          method: req_.method as any,
          headers: {
            ...headers,
            authorization: `Bearer ${currentApiKey}`,
            ...(currentProvider === "anthropic" && { "x-api-key": currentApiKey, "anthropic-version": "2023-06-01" }),
          },
          body: body ?? undefined,
        });

        if (res.statusCode < 400 || ![429, 500, 502, 503, 504].includes(res.statusCode)) {
          break;
        }

        const nextProvider = getNextProvider(currentProvider);
        if (!nextProvider) break;

        const nextApiKey = getUpstreamApiKey(nextProvider);
        const nextBaseUrl = getUpstreamBaseUrl(nextProvider);
        if (!nextApiKey || !nextBaseUrl) break;

        currentProvider = nextProvider;
        currentApiKey = nextApiKey;
        currentUpstreamUrl = `${nextBaseUrl.replace(/\/$/, "")}/v1/${pathSeg}`;
        
        console.log(`Fallback: Switching from ${provider} to ${currentProvider} due to status ${res.statusCode}`);
      }

      const latencyMs = Date.now() - startTime;
      reply_.header("x-proxy-latency-ms", String(latencyMs));
      const contentType =
        (res.headers["content-type"] ?? res.headers["Content-Type"] ?? "") as string;

      const logEntry = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        workspaceId,
        agentId,
        teamId,
        provider: currentProvider,
        model,
        endpoint: `/v1/${pathSeg}`,
        requestTokens: null as number | null,
        responseTokens: null as number | null,
        totalTokens: null as number | null,
        latencyMs,
        statusCode: res.statusCode,
        costUsd: null as number | null,
        error: null as string | null,
      };

      if (contentType.includes("text/event-stream")) {
        await logStore.append(logEntry);
        if (
          options?.rateLimiter &&
          options?.getRateLimitConfig &&
          res.statusCode < 400
        ) {
          const rlConfigs = options.getRateLimitConfig(
            workspaceId,
            teamId,
            agentId
          );
          if (rlConfigs.globalConfig)
            options.rateLimiter.consume(
              `global:${workspaceId}`,
              rlConfigs.globalConfig,
              1,
              0
            );
          if (rlConfigs.teamConfig)
            options.rateLimiter.consume(
              `team:${workspaceId}:${teamId}`,
              rlConfigs.teamConfig,
              1,
              0
            );
          if (rlConfigs.agentConfig)
            options.rateLimiter.consume(
              `agent:${agentId}`,
              rlConfigs.agentConfig,
              1,
              0
            );
        }
        await auditLogger.log(workspaceId, {
          eventType: "proxy.request",
          actorType: "agent",
          actorId: agentId,
          targetType: "model",
          targetId: model,
          action: "proxy",
          outcome: res.statusCode >= 400 ? "error" : "success",
          metadata: { statusCode: res.statusCode, latencyMs },
        });
        reply_.status(res.statusCode).header("content-type", contentType);
        if (res.body) {
          const src = res.body as NodeJS.ReadableStream;
          const rawStream = reply_.raw as NodeJS.WritableStream & { end: () => void };
          src.pipe(rawStream);
          src.on("error", () => rawStream.end());
        } else {
          (reply_.raw as NodeJS.WritableStream & { end: () => void }).end();
        }
        return;
      }

      const buf = await res.body.arrayBuffer();
      const text = Buffer.from(buf).toString("utf-8");
      type Usage = { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
      let usage: Usage | null = null;
      try {
        const json = JSON.parse(text) as { usage?: Usage };
        usage = json.usage ?? null;
      } catch {
        // ignore
      }
      logEntry.requestTokens = usage?.prompt_tokens ?? null;
      logEntry.responseTokens = usage?.completion_tokens ?? null;
      logEntry.totalTokens = usage?.total_tokens ?? null;
      logEntry.costUsd = usage
        ? estimateCost(model, usage.prompt_tokens ?? 0, usage.completion_tokens ?? 0)
        : null;
      await logStore.append(logEntry);
      if (logEntry.costUsd != null) {
        await budgetManager.recordSpend(workspaceId, teamId, agentId, logEntry.costUsd);
      }
      if (
        options?.rateLimiter &&
        options?.getRateLimitConfig &&
        res.statusCode < 400
      ) {
        const rlConfigs = options.getRateLimitConfig(
          workspaceId,
          teamId,
          agentId
        );
        const tokenCount = usage?.total_tokens ?? 0;
        if (rlConfigs.globalConfig)
          options.rateLimiter.consume(
            `global:${workspaceId}`,
            rlConfigs.globalConfig,
            1,
            tokenCount
          );
        if (rlConfigs.teamConfig)
          options.rateLimiter.consume(
            `team:${workspaceId}:${teamId}`,
            rlConfigs.teamConfig,
            1,
            tokenCount
          );
        if (rlConfigs.agentConfig)
          options.rateLimiter.consume(
            `agent:${agentId}`,
            rlConfigs.agentConfig,
            1,
            tokenCount
          );
      }
      auditLogger.log(workspaceId, {
        eventType: "proxy.request",
        actorType: "agent",
        actorId: agentId,
        targetType: "model",
        targetId: model,
        action: "proxy",
        outcome: res.statusCode >= 400 ? "error" : "success",
        metadata: { statusCode: res.statusCode, latencyMs, totalTokens: usage?.total_tokens },
      });
      return reply_.status(res.statusCode).header("content-type", contentType).send(text);
    } catch (err) {
      const latencyMs = Date.now() - startTime;
      const errorMessage = err instanceof Error ? err.message : String(err);
      logStore.append({
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        workspaceId,
        agentId,
        teamId,
        provider,
        model,
        endpoint: `/v1/${pathSeg}`,
        requestTokens: null,
        responseTokens: null,
        totalTokens: null,
        latencyMs,
        statusCode: 502,
        costUsd: null,
        error: errorMessage,
      });
      auditLogger.log(workspaceId, {
        eventType: "proxy.request",
        actorType: "agent",
        actorId: agentId,
        targetType: "model",
        targetId: model,
        action: "proxy",
        outcome: "error",
        metadata: { error: errorMessage, statusCode: 502 },
      });
      return reply_.status(502).send({
        error: "Proxy error",
        message: errorMessage,
      });
    }
  });
}
