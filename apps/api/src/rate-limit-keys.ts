/**
 * Canonical sliding-window keys for the LLM proxy and /api/rate-limits/status.
 * All check/consume paths must use the same strings so limits and diagnostics align.
 */
export function rateLimitWindowKeyGlobal(workspaceId: string): string {
  return `global:${workspaceId}`;
}

export function rateLimitWindowKeyTeam(workspaceId: string, teamId: string): string {
  return `team:${workspaceId}:${teamId}`;
}

export function rateLimitWindowKeyAgent(workspaceId: string, agentId: string): string {
  return `agent:${workspaceId}:${agentId}`;
}
