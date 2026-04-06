import { recordProxyRequest } from "./metrics.js";
import {
  evaluatePolicy,
  estimateCost,
  type LogStore,
  type AgentRegistry,
  type BudgetManager,
  type AuditLogger,
  type PiiDetectorConfig,
  type RateLimitConfig,
  type RateLimiter,
} from "@agent-control-tower/domain";
import { getUpstreamApiKey, getUpstreamBaseUrl } from "./proxy-upstream.js";
import { fetchUpstreamWithRetries } from "./proxy-forward.js";
import { applyProxyPiiGuardrail } from "./proxy-pii.js";
import {
  checkProxyRateLimits,
  consumeProxyRateLimitsAfterSuccess,
  type ProxyRateLimitOptions,
} from "./proxy-rate-limit.js";
import type { ReplyLike } from "./proxy-types.js";

interface ProxyApp {
  all(path: string, handler: (req: unknown, reply: unknown) => Promise<void>): void;
}

/** Normalize Fastify `request.body` (JSON object, raw string, or empty) for upstream proxy + governance. */
export function parseProxyRequestBody(body: unknown): { bodyStr: string | undefined; model: string } {
  let bodyStr: string | undefined;
  if (body === undefined || body === null) {
    bodyStr = undefined;
  } else if (typeof body === "string") {
    bodyStr = body;
  } else if (Buffer.isBuffer(body)) {
    bodyStr = body.toString("utf-8");
  } else if (typeof body === "object") {
    bodyStr = JSON.stringify(body);
  } else {
    bodyStr = String(body);
  }

  let model = "unknown";
  if (body !== null && typeof body === "object" && !Buffer.isBuffer(body)) {
    const m = (body as { model?: unknown }).model;
    if (typeof m === "string") model = m;
  } else if (bodyStr) {
    try {
      const p = JSON.parse(bodyStr) as { model?: string };
      if (typeof p.model === "string") model = p.model;
    } catch {
      // non-JSON body
    }
  }
  return { bodyStr, model };
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
    ) => Promise<PiiDetectorConfig & { enabled: boolean }> | (PiiDetectorConfig & { enabled: boolean });
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
  const retryStatusCodes = new Set([429, 500, 502, 503, 504]);
  const rateLimitOpts = options as ProxyRateLimitOptions | undefined;

  app.all("/v1/*", async (req: unknown, reply: unknown) => {
    const req_ = req as {
      headers: Record<string, string | string[] | undefined>;
      params?: { "*"?: string };
      method: string;
      body?: unknown;
      workspaceId?: string;
      allowedModels?: string[] | null;
    };
    const reply_ = reply as ReplyLike;
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
    const parsedBody = parseProxyRequestBody(req_.body);
    let body: string | undefined = parsedBody.bodyStr;
    let model = parsedBody.model;

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

    const rateOk = await checkProxyRateLimits({
      workspaceId,
      teamId,
      agentId,
      options: rateLimitOpts,
      auditLogger,
      reply: reply_,
    });
    if (!rateOk) {
      return;
    }

    if (body && options?.getPiiConfig) {
      const pii = await applyProxyPiiGuardrail({
        body,
        workspaceId,
        agentId,
        auditLogger,
        reply: reply_,
        getPiiConfig: options.getPiiConfig,
      });
      body = pii.body;
      if (pii.responded) {
        return;
      }
    }

    const headers: Record<string, string> = {
      "content-type": (req_.headers["content-type"] as string) ?? "application/json",
    };

    try {
      const res = await fetchUpstreamWithRetries({
        pathSeg,
        provider,
        initialUpstreamUrl: upstreamUrl,
        initialApiKey: apiKey,
        method: req_.method,
        headers,
        body,
        retryStatusCodes,
      });

      const currentProvider = provider;
      recordProxyRequest(currentProvider, String(res.statusCode));
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
        consumeProxyRateLimitsAfterSuccess({
          options: rateLimitOpts,
          workspaceId,
          teamId,
          agentId,
          statusCode: res.statusCode,
          tokenCount: 0,
          sseMode: true,
        });
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
        reply_
          .status(res.statusCode)
          .header("content-type", contentType)
          .header("cache-control", "no-cache")
          .header("connection", "keep-alive");
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
      const tokenCount = usage?.total_tokens ?? 0;
      consumeProxyRateLimitsAfterSuccess({
        options: rateLimitOpts,
        workspaceId,
        teamId,
        agentId,
        statusCode: res.statusCode,
        tokenCount,
        sseMode: false,
      });
      await auditLogger.log(workspaceId, {
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
      recordProxyRequest(provider, "502");
      const latencyMs = Date.now() - startTime;
      const errorMessage = err instanceof Error ? err.message : String(err);
      await logStore.append({
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
      await auditLogger.log(workspaceId, {
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
