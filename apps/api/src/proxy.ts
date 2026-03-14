import { request as undiciRequest } from "undici";
import {
  DEFAULT_PROVIDERS,
  evaluatePolicy,
  InMemoryLogStore,
  type AgentRegistry,
  type ProxyRequestLog,
} from "@agent-control-tower/domain";

type ProxyApp = {
  all: (path: string, handler: (req: unknown, reply: unknown) => Promise<void>) => void;
};

const logStore = new InMemoryLogStore();

function getUpstreamBaseUrl(provider: string): string | null {
  const config = DEFAULT_PROVIDERS[provider];
  if (!config) return null;
  return config.baseUrl;
}

function getUpstreamApiKey(provider: string): string | null {
  const config = DEFAULT_PROVIDERS[provider];
  if (!config) return null;
  const key = process.env[config.apiKeyEnvVar];
  return key ?? null;
}

export function getLogStore(): InMemoryLogStore {
  return logStore;
}

export function registerProxyRoutes(app: ProxyApp, agentRegistry?: AgentRegistry): void {
  app.all("/v1/*", async (req: unknown, reply: unknown) => {
    const req_ = req as {
      method: string;
      headers: Record<string, string | string[] | undefined>;
      raw: { body?: { text(): Promise<string> } };
      params: { "*"?: string };
      workspaceId?: string;
    };
    type Reply = {
      status(code: number): Reply;
      header(name: string, value: string): Reply;
      send(body: unknown): void;
      raw: NodeJS.WritableStream & { write(chunk: Buffer): void; end(): void };
    };
    const reply_ = reply as Reply;
    const startTime = Date.now();
    const agentId =
      (req_.headers["x-agent-id"] as string) ?? "anonymous";
    const teamId =
      (req_.headers["x-team-id"] as string) ?? "default";
    const provider =
      (req_.headers["x-provider"] as string) ?? "openai";
    const workspaceId = req_.workspaceId ?? "default";

    if (agentRegistry) {
      agentRegistry.ensureExists(workspaceId, agentId);
    }

    const baseUrl = getUpstreamBaseUrl(provider);
    const apiKey = getUpstreamApiKey(provider);

    if (!baseUrl) {
      reply_.status(404).send({
        error: "Unknown provider",
        provider,
      });
      return;
    }

    if (!apiKey) {
      reply_.status(502).send({
        error: "Upstream API key not configured",
        provider,
      });
      return;
    }

    const path = req_.params["*"] ?? "";
    const upstreamUrl = `${baseUrl.replace(/\/$/, "")}/v1/${path}`;

    let body: string | Buffer | undefined;
    let model = "unknown";
    try {
      const rawBody = req_.raw?.body;
      if (rawBody) {
        body = await rawBody.text();
        try {
          const parsed = JSON.parse(body as string) as { model?: string };
          if (parsed.model) model = parsed.model;
        } catch {
          // ignore parse error
        }
      }
    } catch {
      // no body
    }

    const decision = evaluatePolicy({
      actionType: "write",
      target: model,
      external: true,
      amount: undefined,
    });
    if (decision.verdict === "deny") {
      reply_.status(403).send({
        error: "Policy denied",
        rationale: decision.rationale,
      });
      return;
    }

    const headers: Record<string, string> = {
      "content-type": (req_.headers["content-type"] as string) ?? "application/json",
      authorization: (req_.headers["authorization"] as string) ?? `Bearer ${apiKey}`,
    };
    if (req_.headers["x-api-key"])
      headers["x-api-key"] = req_.headers["x-api-key"] as string;

    try {
      const res = await undiciRequest(upstreamUrl, {
        method: req_.method,
        headers,
        body: body ?? undefined,
      });

      const latencyMs = Date.now() - startTime;
      reply_.header("x-proxy-latency-ms", String(latencyMs));

      const contentType =
        res.headers["content-type"] ?? res.headers["Content-Type"] ?? "";

      if (
        typeof contentType === "string" &&
        contentType.includes("text/event-stream")
      ) {
        reply_
          .status(res.statusCode)
          .header("content-type", contentType);
        const logEntry: ProxyRequestLog = {
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          workspaceId,
          agentId,
          teamId,
          provider,
          model,
          endpoint: `/v1/${path}`,
          requestTokens: null,
          responseTokens: null,
          totalTokens: null,
          latencyMs,
          statusCode: res.statusCode,
          costUsd: null,
          error: null,
        };
        logStore.append(logEntry);
        if (res.body) {
          const src = res.body as NodeJS.ReadableStream;
          src.pipe(reply_.raw as NodeJS.WritableStream);
          src.on("error", () => reply_.raw.end());
        } else {
          reply_.raw.end();
        }
      } else {
        const buf = await res.body.arrayBuffer();
        const text = Buffer.from(buf).toString("utf-8");
        type Usage = { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
        let usage: Usage | null = null;
        try {
          const json = JSON.parse(text) as { usage?: Usage };
          usage = json.usage ?? null;
        } catch {
          //
        }
        const logEntry: ProxyRequestLog = {
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          workspaceId,
          agentId,
          teamId,
          provider,
          model,
          endpoint: `/v1/${path}`,
          requestTokens: usage?.prompt_tokens ?? null,
          responseTokens: usage?.completion_tokens ?? null,
          totalTokens: usage?.total_tokens ?? null,
          latencyMs,
          statusCode: res.statusCode,
          costUsd: null,
          error: null,
        };
        logStore.append(logEntry);
        reply_.status(res.statusCode).header("content-type", contentType as string).send(text);
      }
    } catch (err) {
      const latencyMs = Date.now() - startTime;
      const errorMessage = err instanceof Error ? err.message : String(err);
      const logEntry: ProxyRequestLog = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        workspaceId,
        agentId,
        teamId,
        provider,
        model,
        endpoint: `/v1/${path}`,
        requestTokens: null,
        responseTokens: null,
        totalTokens: null,
        latencyMs,
        statusCode: 502,
        costUsd: null,
        error: errorMessage,
      };
      logStore.append(logEntry);
      reply_.status(502).send({
        error: "Proxy error",
        message: errorMessage,
      });
    }
  });
}
