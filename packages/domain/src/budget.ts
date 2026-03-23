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
  ): BudgetCheckResult | Promise<BudgetCheckResult>;
  recordSpend(
    workspaceId: string,
    teamId: string,
    agentId: string,
    costUsd: number
  ): void | Promise<void>;
  setTeamBudget(
    workspaceId: string,
    teamId: string,
    monthlyBudgetUsd: number,
    hardCap?: boolean
  ): void | Promise<void>;
  setAgentBudget(
    workspaceId: string,
    agentId: string,
    dailyBudgetUsd: number,
    hardCap?: boolean
  ): void | Promise<void>;
  getTeamBudget(
    workspaceId: string,
    teamId: string
  ): TeamBudget | null | Promise<TeamBudget | null>;
  getAgentBudget(
    workspaceId: string,
    agentId: string
  ): AgentBudget | null | Promise<AgentBudget | null>;
  listTeamBudgets(workspaceId: string): TeamBudget[] | Promise<TeamBudget[]>;
  resetDailyBudgets(workspaceId: string): void | Promise<void>;
  resetMonthlyBudgets(workspaceId: string): void | Promise<void>;
}
