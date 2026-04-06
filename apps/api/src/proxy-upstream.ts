import { DEFAULT_PROVIDERS } from "@agent-control-tower/domain";

export function getUpstreamBaseUrl(provider: string): string | null {
  const config = DEFAULT_PROVIDERS[provider as keyof typeof DEFAULT_PROVIDERS];
  return config ? config.baseUrl : null;
}

export function getUpstreamApiKey(provider: string): string | null {
  const config = DEFAULT_PROVIDERS[provider as keyof typeof DEFAULT_PROVIDERS];
  if (!config) return null;
  return process.env[config.apiKeyEnvVar] ?? null;
}
