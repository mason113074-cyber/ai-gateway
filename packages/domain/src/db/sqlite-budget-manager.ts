import { eq, and } from "drizzle-orm";
import type { BudgetManager, TeamBudget, AgentBudget } from "../budget";
import type { Database } from "./connection";
import type { RawDatabase } from "./connection";
import { teamBudgets, agentBudgets } from "./schema";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function monthStart(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

function monthEnd(d: Date): string {
  const next = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return next.toISOString().slice(0, 10);
}

export function createSqliteBudgetManager(
  db: Database,
  raw: RawDatabase
): BudgetManager {
  const now = () => new Date().toISOString();

  function ensureTeamPeriod(workspaceId: string, teamId: string): void {
    const row = db
      .select()
      .from(teamBudgets)
      .where(
        and(
          eq(teamBudgets.workspaceId, workspaceId),
          eq(teamBudgets.teamId, teamId)
        )
      )
      .get();
    if (!row) return;
    const today = todayISO();
    if (today > row.periodEnd) {
      const d = new Date();
      db.update(teamBudgets)
        .set({
          currentSpendUsd: 0,
          periodStart: monthStart(d),
          periodEnd: monthEnd(d),
          status: "active",
          updatedAt: now(),
        })
        .where(
          and(
            eq(teamBudgets.workspaceId, workspaceId),
            eq(teamBudgets.teamId, teamId)
          )
        )
        .run();
    }
  }

  function ensureAgentPeriod(workspaceId: string, agentId: string): void {
    const row = db
      .select()
      .from(agentBudgets)
      .where(
        and(
          eq(agentBudgets.workspaceId, workspaceId),
          eq(agentBudgets.agentId, agentId)
        )
      )
      .get();
    if (!row) return;
    const today = todayISO();
    if (today > row.periodStart) {
      db.update(agentBudgets)
        .set({
          currentSpendUsd: 0,
          periodStart: today,
          status: "active",
          updatedAt: now(),
        })
        .where(
          and(
            eq(agentBudgets.workspaceId, workspaceId),
            eq(agentBudgets.agentId, agentId)
          )
        )
        .run();
    }
  }

  function rowToTeamBudget(r: typeof teamBudgets.$inferSelect): TeamBudget {
    return {
      id: r.id,
      workspaceId: r.workspaceId,
      teamId: r.teamId,
      monthlyBudgetUsd: r.monthlyBudgetUsd,
      currentSpendUsd: r.currentSpendUsd,
      periodStart: r.periodStart,
      periodEnd: r.periodEnd,
      hardCap: r.hardCap !== 0,
      alertThresholdPct: r.alertThresholdPct,
      status: r.status as TeamBudget["status"],
    };
  }

  function rowToAgentBudget(r: typeof agentBudgets.$inferSelect): AgentBudget {
    return {
      id: r.id,
      workspaceId: r.workspaceId,
      agentId: r.agentId,
      dailyBudgetUsd: r.dailyBudgetUsd,
      currentSpendUsd: r.currentSpendUsd,
      periodStart: r.periodStart,
      hardCap: r.hardCap !== 0,
      status: r.status as AgentBudget["status"],
    };
  }

  return {
    checkBudget(
      workspaceId: string,
      teamId: string,
      agentId: string,
      estimatedCostUsd: number
    ): import("../budget").BudgetCheckResult {
      ensureTeamPeriod(workspaceId, teamId);
      ensureAgentPeriod(workspaceId, agentId);

      raw.exec("BEGIN IMMEDIATE");
      try {
        const teamRow = db
          .select()
          .from(teamBudgets)
          .where(
            and(
              eq(teamBudgets.workspaceId, workspaceId),
              eq(teamBudgets.teamId, teamId)
            )
          )
          .get();
        const agentRow = db
          .select()
          .from(agentBudgets)
          .where(
            and(
              eq(agentBudgets.workspaceId, workspaceId),
              eq(agentBudgets.agentId, agentId)
            )
          )
          .get();

        let teamRemaining: number | null = null;
        let agentRemaining: number | null = null;
        let allowed = true;
        let reason: string | undefined;

        if (teamRow) {
          teamRemaining = Math.max(
            0,
            teamRow.monthlyBudgetUsd - teamRow.currentSpendUsd
          );
          if (
            teamRow.hardCap !== 0 &&
            teamRow.currentSpendUsd + estimatedCostUsd > teamRow.monthlyBudgetUsd
          ) {
            allowed = false;
            reason = `Team '${teamId}' exceeded monthly budget of $${teamRow.monthlyBudgetUsd.toFixed(2)}`;
          }
        }

        if (agentRow) {
          agentRemaining = Math.max(
            0,
            agentRow.dailyBudgetUsd - agentRow.currentSpendUsd
          );
          if (
            agentRow.hardCap !== 0 &&
            agentRow.currentSpendUsd + estimatedCostUsd > agentRow.dailyBudgetUsd
          ) {
            allowed = false;
            reason = reason
              ? `${reason}; agent '${agentId}' exceeded daily budget`
              : `Agent '${agentId}' exceeded daily budget of $${agentRow.dailyBudgetUsd.toFixed(2)}`;
          }
        }

        raw.exec("COMMIT");
        return {
          allowed,
          teamBudgetRemaining: teamRemaining,
          agentBudgetRemaining: agentRemaining,
          reason,
        };
      } catch (e) {
        raw.exec("ROLLBACK");
        throw e;
      }
    },

    recordSpend(
      workspaceId: string,
      teamId: string,
      agentId: string,
      costUsd: number
    ): void {
      raw.exec("BEGIN IMMEDIATE");
      try {
        const teamRow = db
          .select()
          .from(teamBudgets)
          .where(
            and(
              eq(teamBudgets.workspaceId, workspaceId),
              eq(teamBudgets.teamId, teamId)
            )
          )
          .get();
        if (teamRow) {
          const newSpend = teamRow.currentSpendUsd + costUsd;
          db.update(teamBudgets)
            .set({
              currentSpendUsd: newSpend,
              status:
                newSpend >= teamRow.monthlyBudgetUsd ? "exceeded" : teamRow.status,
              updatedAt: now(),
            })
            .where(
              and(
                eq(teamBudgets.workspaceId, workspaceId),
                eq(teamBudgets.teamId, teamId)
              )
            )
            .run();
        }

        const agentRow = db
          .select()
          .from(agentBudgets)
          .where(
            and(
              eq(agentBudgets.workspaceId, workspaceId),
              eq(agentBudgets.agentId, agentId)
            )
          )
          .get();
        if (agentRow) {
          const newSpend = agentRow.currentSpendUsd + costUsd;
          db.update(agentBudgets)
            .set({
              currentSpendUsd: newSpend,
              status:
                newSpend >= agentRow.dailyBudgetUsd ? "exceeded" : agentRow.status,
              updatedAt: now(),
            })
            .where(
              and(
                eq(agentBudgets.workspaceId, workspaceId),
                eq(agentBudgets.agentId, agentId)
              )
            )
            .run();
        }
        raw.exec("COMMIT");
      } catch (e) {
        raw.exec("ROLLBACK");
        throw e;
      }
    },

    setTeamBudget(
      workspaceId: string,
      teamId: string,
      monthlyBudgetUsd: number,
      hardCap: boolean = true
    ): void {
      const d = new Date();
      const id = `${workspaceId}:team:${teamId}`;
      const createdAt = now();
      const periodStart = monthStart(d);
      const periodEnd = monthEnd(d);
      const existing = db
        .select()
        .from(teamBudgets)
        .where(
          and(
            eq(teamBudgets.workspaceId, workspaceId),
            eq(teamBudgets.teamId, teamId)
          )
        )
        .get();
      if (existing) {
        db.update(teamBudgets)
          .set({
            monthlyBudgetUsd,
            hardCap: hardCap ? 1 : 0,
            updatedAt: now(),
          })
          .where(
            and(
              eq(teamBudgets.workspaceId, workspaceId),
              eq(teamBudgets.teamId, teamId)
            )
          )
          .run();
      } else {
        db.insert(teamBudgets)
          .values({
            id,
            workspaceId,
            teamId,
            monthlyBudgetUsd,
            currentSpendUsd: 0,
            periodStart,
            periodEnd,
            hardCap: hardCap ? 1 : 0,
            alertThresholdPct: 80,
            status: "active",
            createdAt,
            updatedAt: createdAt,
          })
          .run();
      }
    },

    setAgentBudget(
      workspaceId: string,
      agentId: string,
      dailyBudgetUsd: number,
      hardCap: boolean = true
    ): void {
      const today = todayISO();
      const id = `${workspaceId}:agent:${agentId}`;
      const createdAt = now();
      const existing = db
        .select()
        .from(agentBudgets)
        .where(
          and(
            eq(agentBudgets.workspaceId, workspaceId),
            eq(agentBudgets.agentId, agentId)
          )
        )
        .get();
      if (existing) {
        db.update(agentBudgets)
          .set({
            dailyBudgetUsd,
            hardCap: hardCap ? 1 : 0,
            updatedAt: now(),
          })
          .where(
            and(
              eq(agentBudgets.workspaceId, workspaceId),
              eq(agentBudgets.agentId, agentId)
            )
          )
          .run();
      } else {
        db.insert(agentBudgets)
          .values({
            id,
            workspaceId,
            agentId,
            dailyBudgetUsd,
            currentSpendUsd: 0,
            periodStart: today,
            hardCap: hardCap ? 1 : 0,
            status: "active",
            createdAt,
            updatedAt: createdAt,
          })
          .run();
      }
    },

    getTeamBudget(workspaceId: string, teamId: string): TeamBudget | null {
      ensureTeamPeriod(workspaceId, teamId);
      const row = db
        .select()
        .from(teamBudgets)
        .where(
          and(
            eq(teamBudgets.workspaceId, workspaceId),
            eq(teamBudgets.teamId, teamId)
          )
        )
        .get();
      return row ? rowToTeamBudget(row) : null;
    },

    getAgentBudget(workspaceId: string, agentId: string): AgentBudget | null {
      ensureAgentPeriod(workspaceId, agentId);
      const row = db
        .select()
        .from(agentBudgets)
        .where(
          and(
            eq(agentBudgets.workspaceId, workspaceId),
            eq(agentBudgets.agentId, agentId)
          )
        )
        .get();
      return row ? rowToAgentBudget(row) : null;
    },

    listTeamBudgets(workspaceId: string): TeamBudget[] {
      const rows = db
        .select()
        .from(teamBudgets)
        .where(eq(teamBudgets.workspaceId, workspaceId))
        .all();
      rows.forEach((r) => ensureTeamPeriod(workspaceId, r.teamId));
      return rows.map(rowToTeamBudget);
    },

    resetDailyBudgets(workspaceId: string): void {
      const today = todayISO();
      const rows = db
        .select()
        .from(agentBudgets)
        .where(eq(agentBudgets.workspaceId, workspaceId))
        .all();
      for (const r of rows) {
        db.update(agentBudgets)
          .set({
            currentSpendUsd: 0,
            periodStart: today,
            status: "active",
            updatedAt: now(),
          })
          .where(eq(agentBudgets.id, r.id))
          .run();
      }
    },

    resetMonthlyBudgets(workspaceId: string): void {
      const d = new Date();
      const periodStart = monthStart(d);
      const periodEnd = monthEnd(d);
      const rows = db
        .select()
        .from(teamBudgets)
        .where(eq(teamBudgets.workspaceId, workspaceId))
        .all();
      for (const r of rows) {
        db.update(teamBudgets)
          .set({
            currentSpendUsd: 0,
            periodStart,
            periodEnd,
            status: "active",
            updatedAt: now(),
          })
          .where(eq(teamBudgets.id, r.id))
          .run();
      }
    },
  };
}
