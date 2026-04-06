import { requirePermission } from "../require-permission.js";
import type { AppRouteDeps } from "./deps.js";
import type { AuthedRequest } from "./types.js";
import type { RouteApp } from "./route-app.js";

export function registerBudgetRoutes(app: RouteApp, deps: AppRouteDeps): void {
  const { budgetManager } = deps;

  app.get(
    "/api/budgets/teams",
    { preHandler: [requirePermission("read:costs")] },
    async (request: AuthedRequest) => {
      const workspaceId = request.workspaceId ?? "default";
      return { items: await budgetManager.listTeamBudgets(workspaceId) };
    }
  );

  app.post(
    "/api/budgets/teams",
    { preHandler: [requirePermission("write:budgets")] },
    async (
      request: AuthedRequest & {
        body?: { teamId?: string; monthlyBudgetUsd?: number; hardCap?: boolean };
      }
    ) => {
      const workspaceId = request.workspaceId ?? "default";
      const { teamId, monthlyBudgetUsd, hardCap } = request.body ?? {};
      if (!teamId || monthlyBudgetUsd == null) {
        throw { statusCode: 400, message: "teamId and monthlyBudgetUsd required" };
      }
      await budgetManager.setTeamBudget(
        workspaceId,
        teamId,
        Number(monthlyBudgetUsd),
        hardCap ?? true
      );
      return await budgetManager.getTeamBudget(workspaceId, teamId);
    }
  );

  app.get(
    "/api/budgets/teams/:teamId",
    { preHandler: [requirePermission("read:costs")] },
    async (request: AuthedRequest & { params?: { teamId: string } }) => {
      const workspaceId = request.workspaceId ?? "default";
      const teamId = request.params?.teamId;
      if (!teamId) throw { statusCode: 400, message: "teamId required" };
      const budget = await budgetManager.getTeamBudget(workspaceId, teamId);
      if (!budget) throw { statusCode: 404, message: "Budget not found" };
      return budget;
    }
  );

  app.post(
    "/api/budgets/agents",
    { preHandler: [requirePermission("write:budgets")] },
    async (
      request: AuthedRequest & {
        body?: { agentId?: string; dailyBudgetUsd?: number; hardCap?: boolean };
      }
    ) => {
      const workspaceId = request.workspaceId ?? "default";
      const { agentId, dailyBudgetUsd, hardCap } = request.body ?? {};
      if (!agentId || dailyBudgetUsd == null) {
        throw { statusCode: 400, message: "agentId and dailyBudgetUsd required" };
      }
      await budgetManager.setAgentBudget(
        workspaceId,
        agentId,
        Number(dailyBudgetUsd),
        hardCap ?? true
      );
      return await budgetManager.getAgentBudget(workspaceId, agentId);
    }
  );

  app.get(
    "/api/budgets/agents/:agentId",
    { preHandler: [requirePermission("read:costs")] },
    async (request: AuthedRequest & { params?: { agentId: string } }) => {
      const workspaceId = request.workspaceId ?? "default";
      const agentId = request.params?.agentId;
      if (!agentId) throw { statusCode: 400, message: "agentId required" };
      const budget = await budgetManager.getAgentBudget(workspaceId, agentId);
      if (!budget) throw { statusCode: 404, message: "Budget not found" };
      return budget;
    }
  );
}
