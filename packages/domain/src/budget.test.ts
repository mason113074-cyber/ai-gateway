import { describe, it, expect, beforeEach } from "vitest";
import { createDatabaseWithRaw } from "./db/connection";
import { createBudgetManager } from "./db/budget-manager";

const canLoadSqlite = (() => {
  try {
    createDatabaseWithRaw(":memory:");
    return true;
  } catch {
    return false;
  }
})();

describe.runIf(canLoadSqlite)("SqliteBudgetManager", () => {
  let budgetManager: ReturnType<typeof createBudgetManager>;

  beforeEach(() => {
    const { db, raw } = createDatabaseWithRaw(":memory:");
    budgetManager = createBudgetManager(db, raw);
  });

  it("should allow request within team budget", async () => {
    await budgetManager.setTeamBudget("ws1", "team-a", 100, true);
    const result = await budgetManager.checkBudget("ws1", "team-a", "agent-1", 5);
    expect(result.allowed).toBe(true);
    expect(result.teamBudgetRemaining).toBe(100);
  });

  it("should deny request when team hard cap exceeded", async () => {
    await budgetManager.setTeamBudget("ws1", "team-a", 10, true);
    await budgetManager.recordSpend("ws1", "team-a", "agent-1", 9);
    const result = await budgetManager.checkBudget("ws1", "team-a", "agent-1", 5);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("exceeded");
  });

  it("should allow request when team soft cap exceeded", async () => {
    await budgetManager.setTeamBudget("ws1", "team-a", 10, false);
    await budgetManager.recordSpend("ws1", "team-a", "agent-1", 15);
    const result = await budgetManager.checkBudget("ws1", "team-a", "agent-1", 1);
    expect(result.allowed).toBe(true);
  });

  it("should deny request when agent daily hard cap exceeded", async () => {
    await budgetManager.setAgentBudget("ws1", "agent-1", 5, true);
    await budgetManager.recordSpend("ws1", "team-a", "agent-1", 4);
    const result = await budgetManager.checkBudget("ws1", "team-a", "agent-1", 3);
    expect(result.allowed).toBe(false);
  });

  it("should atomically update spend on recordSpend", async () => {
    await budgetManager.setTeamBudget("ws1", "team-a", 100, true);
    await budgetManager.recordSpend("ws1", "team-a", "agent-1", 3);
    await budgetManager.recordSpend("ws1", "team-a", "agent-1", 4);
    const budget = await budgetManager.getTeamBudget("ws1", "team-a");
    expect(budget?.currentSpendUsd).toBe(7);
  });

  it("should reset daily agent budgets", async () => {
    await budgetManager.setAgentBudget("ws1", "agent-1", 10, true);
    await budgetManager.recordSpend("ws1", "team-a", "agent-1", 2);
    await budgetManager.resetDailyBudgets("ws1");
    const budget = await budgetManager.getAgentBudget("ws1", "agent-1");
    expect(budget?.currentSpendUsd).toBe(0);
  });

  it("should reset monthly team budgets", async () => {
    await budgetManager.setTeamBudget("ws1", "team-a", 100, true);
    await budgetManager.recordSpend("ws1", "team-a", "agent-1", 20);
    await budgetManager.resetMonthlyBudgets("ws1");
    const budget = await budgetManager.getTeamBudget("ws1", "team-a");
    expect(budget?.currentSpendUsd).toBe(0);
  });

  it("should return null remaining when no budget set", async () => {
    const result = await budgetManager.checkBudget("ws1", "team-x", "agent-1", 5);
    expect(result.teamBudgetRemaining).toBeNull();
    expect(result.agentBudgetRemaining).toBeNull();
    expect(result.allowed).toBe(true);
  });
});
