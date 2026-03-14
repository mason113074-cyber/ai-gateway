export interface TeamBudget {
  id: string;
  workspaceId: string;
  teamId: string;
  monthlyBudgetUsd: number;
  currentSpendUsd: number;
  periodStart: string;
  periodEnd: string;
  hardCap: boolean;
  alertThresholdPct: number;
  status: "active" | "exceeded" | "paused";
}

export interface AgentBudget {
  id: string;
  workspaceId: string;
  agentId: string;
  dailyBudgetUsd: number;
  currentSpendUsd: number;
  periodStart: string;
  hardCap: boolean;
  status: "active" | "exceeded" | "paused";
}

export interface BudgetCheckResult {
  allowed: boolean;
  teamBudgetRemaining: number | null;
  agentBudgetRemaining: number | null;
  reason?: string;
}

export interface BudgetManager {
  checkBudget(
    workspaceId: string,
    teamId: string,
    agentId: string,
    estimatedCostUsd: number
  ): BudgetCheckResult;
  recordSpend(
    workspaceId: string,
    teamId: string,
    agentId: string,
    costUsd: number
  ): void;
  setTeamBudget(
    workspaceId: string,
    teamId: string,
    monthlyBudgetUsd: number,
    hardCap?: boolean
  ): void;
  setAgentBudget(
    workspaceId: string,
    agentId: string,
    dailyBudgetUsd: number,
    hardCap?: boolean
  ): void;
  getTeamBudget(workspaceId: string, teamId: string): TeamBudget | null;
  getAgentBudget(workspaceId: string, agentId: string): AgentBudget | null;
  listTeamBudgets(workspaceId: string): TeamBudget[];
  resetDailyBudgets(workspaceId: string): void;
  resetMonthlyBudgets(workspaceId: string): void;
}
