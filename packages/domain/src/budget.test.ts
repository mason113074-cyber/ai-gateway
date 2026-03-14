import { describe, it, expect, beforeEach } from "vitest";
import { createDatabaseWithRaw } from "./db/connection";
import { createSqliteBudgetManager } from "./db/sqlite-budget-manager";

const canLoadSqlite = (() => {
  try {
    createDatabaseWithRaw(":memory:");
    return true;
  } catch {
    return false;
  }
})();

describe.runIf(canLoadSqlite)("SqliteBudgetManager", () => {
  let budgetManager: ReturnType<typeof createSqliteBudgetManager>;

  beforeEach(() => {
    const { db, raw } = createDatabaseWithRaw(":memory:");
    budgetManager = createSqliteBudgetManager(db, raw);
  });

  it("should allow request within team budget", () => {
    budgetManager.setTeamBudget("ws1", "team-a", 100, true);
    const result = budgetManager.checkBudget("ws1", "team-a", "agent-1", 5);
    expect(result.allowed).toBe(true);
    expect(result.teamBudgetRemaining).toBe(100);
  });

  it("should deny request when team hard cap exceeded", () => {
    budgetManager.setTeamBudget("ws1", "team-a", 10, true);
    budgetManager.recordSpend("ws1", "team-a", "agent-1", 9);
    const result = budgetManager.checkBudget("ws1", "team-a", "agent-1", 5);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("exceeded");
  });

  it("should allow request when team soft cap exceeded", () => {
    budgetManager.setTeamBudget("ws1", "team-a", 10, false);
    budgetManager.recordSpend("ws1", "team-a", "agent-1", 15);
    const result = budgetManager.checkBudget("ws1", "team-a", "agent-1", 1);
    expect(result.allowed).toBe(true);
  });

  it("should deny request when agent daily hard cap exceeded", () => {
    budgetManager.setAgentBudget("ws1", "agent-1", 5, true);
    budgetManager.recordSpend("ws1", "team-a", "agent-1", 4);
    const result = budgetManager.checkBudget("ws1", "team-a", "agent-1", 3);
    expect(result.allowed).toBe(false);
  });

  it("should atomically update spend on recordSpend", () => {
    budgetManager.setTeamBudget("ws1", "team-a", 100, true);
    budgetManager.recordSpend("ws1", "team-a", "agent-1", 3);
    budgetManager.recordSpend("ws1", "team-a", "agent-1", 4);
    const budget = budgetManager.getTeamBudget("ws1", "team-a");
    expect(budget?.currentSpendUsd).toBe(7);
  });

  it("should reset daily agent budgets", () => {
    budgetManager.setAgentBudget("ws1", "agent-1", 10, true);
    budgetManager.recordSpend("ws1", "team-a", "agent-1", 2);
    budgetManager.resetDailyBudgets("ws1");
    const budget = budgetManager.getAgentBudget("ws1", "agent-1");
    expect(budget?.currentSpendUsd).toBe(0);
  });

  it("should reset monthly team budgets", () => {
    budgetManager.setTeamBudget("ws1", "team-a", 100, true);
    budgetManager.recordSpend("ws1", "team-a", "agent-1", 20);
    budgetManager.resetMonthlyBudgets("ws1");
    const budget = budgetManager.getTeamBudget("ws1", "team-a");
    expect(budget?.currentSpendUsd).toBe(0);
  });

  it("should return null remaining when no budget set", () => {
    const result = budgetManager.checkBudget("ws1", "team-x", "agent-1", 5);
    expect(result.teamBudgetRemaining).toBeNull();
    expect(result.agentBudgetRemaining).toBeNull();
    expect(result.allowed).toBe(true);
  });
});
