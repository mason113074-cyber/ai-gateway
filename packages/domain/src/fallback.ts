export interface FallbackConfig {
  primaryProvider: string;
  fallbackProviders: string[];
  retryOnStatusCodes: number[];
}

export const DEFAULT_FALLBACK_CONFIG: FallbackConfig = {
  primaryProvider: "openai",
  fallbackProviders: ["anthropic"],
  retryOnStatusCodes: [429, 500, 502, 503, 504],
};

export function getNextProvider(
  currentProvider: string,
  config: FallbackConfig = DEFAULT_FALLBACK_CONFIG
): string | null {
  const allProviders = [config.primaryProvider, ...config.fallbackProviders];
  const currentIndex = allProviders.indexOf(currentProvider);
  
  if (currentIndex === -1 || currentIndex === allProviders.length - 1) {
    return null;
  }
  
  return allProviders[currentIndex + 1];
}
