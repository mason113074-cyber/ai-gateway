/**
 * Server-side helpers for the Next.js → Fastify admin API bridge (`/api/gateway/*`).
 *
 * Deployment model (self-hosted):
 * - Browser calls same-origin `/api/gateway/...` (Next Route Handler).
 * - The Route Handler uses `getGatewayApiBaseUrl()` to reach the Fastify API (same machine,
 *   Docker network `http://api:4000`, or any URL you set).
 * - Every proxied request must present `Authorization: Bearer <BOOTSTRAP_ADMIN_TOKEN>` so the
 *   API treats the call as the bootstrap admin workspace (see API auth middleware).
 *
 * Trust assumptions:
 * - `BOOTSTRAP_ADMIN_TOKEN` is a shared secret between the web server process and the API.
 *   It must not be exposed to browsers — only server-side code reads it here.
 * - End users never send this token from the client; only the Next server attaches it.
 * - This pattern is convenient for local/dev and small self-hosted setups; it is not a
 *   substitute for per-user SSO or full zero-trust networking.
 *
 * Limitations:
 * - If `BOOTSTRAP_ADMIN_TOKEN` is missing, admin UI API calls return 503 from the proxy route.
 * - Rotating the token requires updating both API and web environments together.
 */

export function getGatewayApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
}

export function getGatewayAdminToken(): string {
  const token = process.env.BOOTSTRAP_ADMIN_TOKEN;
  if (!token) {
    throw new Error(
      "BOOTSTRAP_ADMIN_TOKEN is required for web admin requests. Set it in apps/web runtime environment."
    );
  }
  return token;
}

export function withGatewayAdminAuth(
  headersInit?: HeadersInit
): Headers {
  const headers = new Headers(headersInit);
  headers.set("authorization", `Bearer ${getGatewayAdminToken()}`);
  return headers;
}

export function getServerAdminHeaders(): Record<string, string> {
  return { authorization: `Bearer ${getGatewayAdminToken()}` };
}

export function isServerAdminAuthConfigured(): boolean {
  return Boolean(process.env.BOOTSTRAP_ADMIN_TOKEN);
}
