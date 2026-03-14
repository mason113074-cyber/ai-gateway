import { request as undiciRequest } from "undici";
import {
  DEFAULT_PROVIDERS,
  evaluatePolicy,
  estimateCost,
  type LogStore,
  type AgentRegistry,
  type BudgetManager,
  type AuditLogger,
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
  auditLogger: AuditLogger
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

    agentRegistry.ensureExists(workspaceId, agentId);

    const baseUrl = getUpstreamBaseUrl(provider);
    const apiKey = getUpstreamApiKey(provider);
    if (!baseUrl) {
      auditLogger.log(workspaceId, {
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
      auditLogger.log(workspaceId, {
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
      auditLogger.log(workspaceId, {
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
        auditLogger.log(workspaceId, {
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
    const budgetCheck = budgetManager.checkBudget(workspaceId, teamId, agentId, estimatedCostUsd);
    if (!budgetCheck.allowed) {
      auditLogger.log(workspaceId, {
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

    const headers: Record<string, string> = {
      "content-type": (req_.headers["content-type"] as string) ?? "application/json",
      authorization: (req_.headers["authorization"] as string) ?? `Bearer ${apiKey}`,
    };
    if (req_.headers["x-api-key"]) headers["x-api-key"] = req_.headers["x-api-key"] as string;

    try {
      const res = await undiciRequest(upstreamUrl, {
        method: req_.method,
        headers,
        body: body ?? undefined,
      });
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
        provider,
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
        logStore.append(logEntry);
        auditLogger.log(workspaceId, {
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
      logStore.append(logEntry);
      if (logEntry.costUsd != null) {
        budgetManager.recordSpend(workspaceId, teamId, agentId, logEntry.costUsd);
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
