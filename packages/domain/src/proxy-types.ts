export interface ProxyRequestLog {
  id: string;
  timestamp: string;
  workspaceId: string;
  agentId: string;
  teamId: string;
  provider: string;
  model: string;
  endpoint: string;
  requestTokens: number | null;
  responseTokens: number | null;
  totalTokens: number | null;
  latencyMs: number;
  statusCode: number;
  costUsd: number | null;
  error: string | null;
}

export interface ProxyConfig {
  providers: Record<
    string,
    {
      baseUrl: string;
      apiKeyEnvVar: string;
    }
  >;
}

export const DEFAULT_PROVIDERS: ProxyConfig["providers"] = {
  openai: {
    baseUrl: "https://api.openai.com",
    apiKeyEnvVar: "OPENAI_API_KEY",
  },
  anthropic: {
    baseUrl: "https://api.anthropic.com",
    apiKeyEnvVar: "ANTHROPIC_API_KEY",
  },
};
