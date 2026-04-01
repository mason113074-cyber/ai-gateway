import { eq, and } from "drizzle-orm";
import type { BudgetManager, TeamBudget, AgentBudget } from "../budget";
import type { Database, RawDatabase } from "./connection";
import schema from "./schema.js";

const { teamBudgets, agentBudgets } = schema;

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

export function createBudgetManager(
  db: Database,
  raw: RawDatabase
): BudgetManager {
  const now = () => new Date().toISOString();

  async function ensureTeamPeriod(workspaceId: string, teamId: string): Promise<void> {
    const query = db
      .select()
      .from(teamBudgets)
      .where(
        and(
          eq(teamBudgets.workspaceId, workspaceId),
          eq(teamBudgets.teamId, teamId)
        )
      );
    const row = (query as any).get();
    if (!row) return;
    
    const today = todayISO();
    const periodEndStr = row.periodEnd instanceof Date ? row.periodEnd.toISOString().slice(0, 10) : row.periodEnd;
    
    if (today > periodEndStr) {
      const d = new Date();
      const updateQuery = db.update(teamBudgets)
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
        );
      (updateQuery as any).run();
    }
  }

  async function ensureAgentPeriod(workspaceId: string, agentId: string): Promise<void> {
    const query = db
      .select()
      .from(agentBudgets)
      .where(
        and(
          eq(agentBudgets.workspaceId, workspaceId),
          eq(agentBudgets.agentId, agentId)
        )
      );
    const row = (query as any).get();
    if (!row) return;
    
    const today = todayISO();
    const periodStartStr = row.periodStart instanceof Date ? row.periodStart.toISOString().slice(0, 10) : row.periodStart;
    
    if (today > periodStartStr) {
      const updateQuery = db.update(agentBudgets)
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
        );
      (updateQuery as any).run();
    }
  }

  function rowToTeamBudget(r: any): TeamBudget {
    return {
      id: r.id,
      workspaceId: r.workspaceId,
      teamId: r.teamId,
      monthlyBudgetUsd: r.monthlyBudgetUsd,
      currentSpendUsd: r.currentSpendUsd,
      periodStart: r.periodStart instanceof Date ? r.periodStart.toISOString().slice(0, 10) : r.periodStart,
      periodEnd: r.periodEnd instanceof Date ? r.periodEnd.toISOString().slice(0, 10) : r.periodEnd,
      hardCap: r.hardCap !== 0,
      alertThresholdPct: r.alertThresholdPct,
      status: r.status as TeamBudget["status"],
    };
  }

  function rowToAgentBudget(r: any): AgentBudget {
    return {
      id: r.id,
      workspaceId: r.workspaceId,
      agentId: r.agentId,
      dailyBudgetUsd: r.dailyBudgetUsd,
      currentSpendUsd: r.currentSpendUsd,
      periodStart: r.periodStart instanceof Date ? r.periodStart.toISOString().slice(0, 10) : r.periodStart,
      hardCap: r.hardCap !== 0,
      status: r.status as AgentBudget["status"],
    };
  }

  return {
    async checkBudget(
      workspaceId: string,
      teamId: string,
      agentId: string,
      estimatedCostUsd: number
    ): Promise<import("../budget").BudgetCheckResult> {
      await ensureTeamPeriod(workspaceId, teamId);
      await ensureAgentPeriod(workspaceId, agentId);

      (raw as any).exec("BEGIN IMMEDIATE");
      try {
        const teamQuery = db
          .select()
          .from(teamBudgets)
          .where(
            and(
              eq(teamBudgets.workspaceId, workspaceId),
              eq(teamBudgets.teamId, teamId)
            )
          );
        const agentQuery = db
          .select()
          .from(agentBudgets)
          .where(
            and(
              eq(agentBudgets.workspaceId, workspaceId),
              eq(agentBudgets.agentId, agentId)
            )
          );

        const teamRow = (teamQuery as any).get();
        const agentRow = (agentQuery as any).get();

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

        (raw as any).exec("COMMIT");
        return {
          allowed,
          teamBudgetRemaining: teamRemaining,
          agentBudgetRemaining: agentRemaining,
          reason,
        };
      } catch (e) {
        (raw as any).exec("ROLLBACK");
        throw e;
      }
    },

    async recordSpend(
      workspaceId: string,
      teamId: string,
      agentId: string,
      costUsd: number
    ): Promise<void> {
      (raw as any).exec("BEGIN IMMEDIATE");
      try {
        const teamQuery = db
          .select()
          .from(teamBudgets)
          .where(
            and(
              eq(teamBudgets.workspaceId, workspaceId),
              eq(teamBudgets.teamId, teamId)
            )
          );
        const teamRow = (teamQuery as any).get();
        
        if (teamRow) {
          const newSpend = teamRow.currentSpendUsd + costUsd;
          const updateQuery = db.update(teamBudgets)
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
            );
          (updateQuery as any).run();
        }

        const agentQuery = db
          .select()
          .from(agentBudgets)
          .where(
            and(
              eq(agentBudgets.workspaceId, workspaceId),
              eq(agentBudgets.agentId, agentId)
            )
          );
        const agentRow = (agentQuery as any).get();
        
        if (agentRow) {
          const newSpend = agentRow.currentSpendUsd + costUsd;
          const updateQuery = db.update(agentBudgets)
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
            );
          (updateQuery as any).run();
        }
        (raw as any).exec("COMMIT");
      } catch (e) {
        (raw as any).exec("ROLLBACK");
        throw e;
      }
    },

    async setTeamBudget(
      workspaceId: string,
      teamId: string,
      monthlyBudgetUsd: number,
      hardCap: boolean = true
    ): Promise<void> {
      const d = new Date();
      const id = `${workspaceId}:team:${teamId}`;
      const createdAt = now();
      const periodStart = monthStart(d);
      const periodEnd = monthEnd(d);
      
      const query = db
        .select()
        .from(teamBudgets)
        .where(
          and(
            eq(teamBudgets.workspaceId, workspaceId),
            eq(teamBudgets.teamId, teamId)
          )
        );
      const existing = (query as any).get();
      
      if (existing) {
        const updateQuery = db.update(teamBudgets)
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
          );
        (updateQuery as any).run();
      } else {
        const values = {
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
          };
        (db.insert(teamBudgets) as any).values(values).run();
      }
    },

    async setAgentBudget(
      workspaceId: string,
      agentId: string,
      dailyBudgetUsd: number,
      hardCap: boolean = true
    ): Promise<void> {
      const today = todayISO();
      const id = `${workspaceId}:agent:${agentId}`;
      const createdAt = now();
      
      const query = db
        .select()
        .from(agentBudgets)
        .where(
          and(
            eq(agentBudgets.workspaceId, workspaceId),
            eq(agentBudgets.agentId, agentId)
          )
        );
      const existing = (query as any).get();
      
      if (existing) {
        const updateQuery = db.update(agentBudgets)
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
          );
        (updateQuery as any).run();
      } else {
        const values = {
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
          };
        (db.insert(agentBudgets) as any).values(values).run();
      }
    },

    async getTeamBudget(workspaceId: string, teamId: string): Promise<TeamBudget | null> {
      await ensureTeamPeriod(workspaceId, teamId);
      const query = db
        .select()
        .from(teamBudgets)
        .where(
          and(
            eq(teamBudgets.workspaceId, workspaceId),
            eq(teamBudgets.teamId, teamId)
          )
        );
      const row = (query as any).get();
      return row ? rowToTeamBudget(row) : null;
    },

    async getAgentBudget(workspaceId: string, agentId: string): Promise<AgentBudget | null> {
      await ensureAgentPeriod(workspaceId, agentId);
      const query = db
        .select()
        .from(agentBudgets)
        .where(
          and(
            eq(agentBudgets.workspaceId, workspaceId),
            eq(agentBudgets.agentId, agentId)
          )
        );
      const row = (query as any).get();
      return row ? rowToAgentBudget(row) : null;
    },

    async listTeamBudgets(workspaceId: string): Promise<TeamBudget[]> {
      const query = db
        .select()
        .from(teamBudgets)
        .where(eq(teamBudgets.workspaceId, workspaceId));
      const rows = (query as any).all();
      for (const r of rows) await ensureTeamPeriod(workspaceId, r.teamId);
      return rows.map(rowToTeamBudget);
    },

    async resetDailyBudgets(workspaceId: string): Promise<void> {
      const today = todayISO();
      const query = db
        .select()
        .from(agentBudgets)
        .where(eq(agentBudgets.workspaceId, workspaceId));
      const rows = (query as any).all();
      
      for (const r of rows) {
        const updateQuery = db.update(agentBudgets)
          .set({
            currentSpendUsd: 0,
            periodStart: today,
            status: "active",
            updatedAt: now(),
          })
          .where(eq(agentBudgets.id, r.id));
        (updateQuery as any).run();
      }
    },

    async resetMonthlyBudgets(workspaceId: string): Promise<void> {
      const d = new Date();
      const periodStart = monthStart(d);
      const periodEnd = monthEnd(d);
      const query = db
        .select()
        .from(teamBudgets)
        .where(eq(teamBudgets.workspaceId, workspaceId));
      const rows = (query as any).all();
      
      for (const r of rows) {
        const updateQuery = db.update(teamBudgets)
          .set({
            currentSpendUsd: 0,
            periodStart,
            periodEnd,
            status: "active",
            updatedAt: now(),
          })
          .where(eq(teamBudgets.id, r.id));
        (updateQuery as any).run();
      }
    },
  };
}
