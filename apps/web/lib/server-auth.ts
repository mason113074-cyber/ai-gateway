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
