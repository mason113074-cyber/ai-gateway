/** Per-model cost table (USD per 1K tokens) */
export const MODEL_COSTS: Record<
  string,
  { input: number; output: number }
> = {
  "gpt-4o": { input: 0.0025, output: 0.01 },
  "gpt-4o-mini": { input: 0.00015, output: 0.0006 },
  "gpt-4-turbo": { input: 0.01, output: 0.03 },
  "gpt-3.5-turbo": { input: 0.0005, output: 0.0015 },
  "claude-3-5-sonnet": { input: 0.003, output: 0.015 },
  "claude-3-5-sonnet-20241022": { input: 0.003, output: 0.015 },
  "claude-3-5-haiku": { input: 0.0008, output: 0.004 },
  "claude-3-5-haiku-20241022": { input: 0.0008, output: 0.004 },
  "claude-3-opus": { input: 0.015, output: 0.075 },
  "claude-3-opus-20240229": { input: 0.015, output: 0.075 },
  "claude-3-sonnet-20240229": { input: 0.003, output: 0.015 },
  "claude-3-haiku-20240307": { input: 0.00025, output: 0.00125 },
};

/** Fallback cost entry for unknown models, keyed by provider name prefix.
 * Entries are checked in order; the first prefix that matches wins.
 * Falls back to gpt-4o pricing when no prefix matches.
 */
const PROVIDER_FALLBACK_COSTS: Array<{
  prefix: string;
  cost: { input: number; output: number };
}> = [
  { prefix: "claude-", cost: MODEL_COSTS["claude-3-5-sonnet"] },
  { prefix: "gpt-", cost: MODEL_COSTS["gpt-4o"] },
];

export function estimateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const costs =
    MODEL_COSTS[model] ??
    PROVIDER_FALLBACK_COSTS.find(({ prefix }) => model.startsWith(prefix))
      ?.cost ??
    MODEL_COSTS["gpt-4o"];
  return (
    (inputTokens / 1000) * costs.input + (outputTokens / 1000) * costs.output
  );
}
