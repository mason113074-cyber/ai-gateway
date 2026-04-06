import { request as undiciRequest } from "undici";
import { getUpstreamApiKey, getUpstreamBaseUrl } from "./proxy-upstream.js";

const DEFAULT_RETRY_STATUS = new Set([429, 500, 502, 503, 504]);

/**
 * Calls the upstream LLM HTTP API with same-provider retries on transient failures.
 * The first attempt uses `initialUpstreamUrl` / `initialApiKey` from the caller; retries
 * refresh credentials from `getUpstream*` for the same `provider`.
 */
export async function fetchUpstreamWithRetries(params: {
  pathSeg: string;
  provider: string;
  initialUpstreamUrl: string;
  initialApiKey: string;
  method: string;
  headers: Record<string, string>;
  body: string | undefined;
  maxAttempts?: number;
  retryStatusCodes?: Set<number>;
}): Promise<Awaited<ReturnType<typeof undiciRequest>>> {
  const {
    pathSeg,
    provider: initialProvider,
    initialUpstreamUrl,
    initialApiKey,
    method,
    headers,
    body,
    maxAttempts = 3,
    retryStatusCodes = DEFAULT_RETRY_STATUS,
  } = params;

  let currentProvider = initialProvider;
  let currentApiKey = initialApiKey;
  let currentUpstreamUrl = initialUpstreamUrl;

  let res: Awaited<ReturnType<typeof undiciRequest>> | null = null;
  let attempts = 0;

  while (attempts < maxAttempts) {
    attempts++;
    res = await undiciRequest(currentUpstreamUrl, {
      method,
      headers: {
        ...headers,
        ...(currentProvider !== "anthropic" && {
          authorization: `Bearer ${currentApiKey}`,
        }),
        ...(currentProvider === "anthropic" && {
          "x-api-key": currentApiKey,
          "anthropic-version": "2023-06-01",
        }),
      },
      body: body ?? undefined,
    });

    if (res.statusCode < 400 || !retryStatusCodes.has(res.statusCode)) {
      break;
    }

    const nextApiKey = getUpstreamApiKey(currentProvider);
    const nextBaseUrl = getUpstreamBaseUrl(currentProvider);
    if (!nextApiKey || !nextBaseUrl) break;
    currentApiKey = nextApiKey;
    currentUpstreamUrl = `${nextBaseUrl.replace(/\/$/, "")}/v1/${pathSeg}`;
  }

  if (!res) {
    throw new Error("No upstream response available");
  }
  return res;
}
