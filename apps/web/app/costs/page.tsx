"use client";

import { useEffect, useState } from "react";

const API_BASE = typeof window !== "undefined" ? "" : process.env.NEXT_PUBLIC_API_URL ?? "";

type TeamBudget = {
  id: string;
  teamId: string;
  monthlyBudgetUsd: number;
  currentSpendUsd: number;
  hardCap: boolean;
  status: string;
};

type AgentBudget = {
  id: string;
  agentId: string;
  dailyBudgetUsd: number;
  currentSpendUsd: number;
  hardCap: boolean;
  status: string;
};

type CostRow = {
  groupKey: string;
  totalCostUsd: number;
  totalTokens: number;
  requestCount: number;
};

function Bar({ pct, exceeded }: { pct: number; exceeded?: boolean }) {
  const capped = Math.min(100, pct);
  const color =
    exceeded ? "var(--red, #c00)" :
    capped >= 80 ? "var(--orange, #f80)" :
    capped >= 60 ? "var(--yellow, #fa0)" :
    "var(--green, #0a0)";
  return (
    <div
      style={{
        width: "100%",
        maxWidth: 200,
        height: 12,
        backgroundColor: "var(--surface, #eee)",
        borderRadius: 4,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${capped}%`,
          height: "100%",
          backgroundColor: color,
          transition: "width 0.2s",
          ...(exceeded && { opacity: 0.9 }),
        }}
      />
    </div>
  );
}

export default function CostsPage() {
  const [teamBudgets, setTeamBudgets] = useState<TeamBudget[]>([]);
  const [costsByTeam, setCostsByTeam] = useState<CostRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [setBudgetType, setSetBudgetType] = useState<"team" | "agent">("team");
  const [setBudgetId, setSetBudgetId] = useState("");
  const [setBudgetAmount, setSetBudgetAmount] = useState("");
  const [setBudgetHardCap, setSetBudgetHardCap] = useState(true);

  useEffect(() => {
    const headers = { "x-workspace-id": "default" };
    Promise.all([
      fetch(`${API_BASE}/api/budgets/teams`, { headers }).then((r) => r.json()),
      fetch(`${API_BASE}/api/costs?groupBy=team`, { headers }).then((r) => r.json()),
    ])
      .then(([teamsRes, costsRes]) => {
        setTeamBudgets(teamsRes.items ?? []);
        setCostsByTeam(costsRes.items ?? []);
      })
      .catch(() => {
        setTeamBudgets([]);
        setCostsByTeam([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSetBudget = async () => {
    const amount = Number(setBudgetAmount);
    if (!setBudgetId || Number.isNaN(amount) || amount <= 0) return;
    const url =
      setBudgetType === "team"
        ? `${API_BASE}/api/budgets/teams`
        : `${API_BASE}/api/budgets/agents`;
    const body =
      setBudgetType === "team"
        ? { teamId: setBudgetId, monthlyBudgetUsd: amount, hardCap: setBudgetHardCap }
        : { agentId: setBudgetId, dailyBudgetUsd: amount, hardCap: setBudgetHardCap };
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-workspace-id": "default" },
      body: JSON.stringify(body),
    });
    setSetBudgetId("");
    setSetBudgetAmount("");
    const [teamsRes, costsRes] = await Promise.all([
      fetch(`${API_BASE}/api/budgets/teams`, { headers: { "x-workspace-id": "default" } }).then((r) => r.json()),
      fetch(`${API_BASE}/api/costs?groupBy=team`, { headers: { "x-workspace-id": "default" } }).then((r) => r.json()),
    ]);
    setTeamBudgets(teamsRes.items ?? []);
    setCostsByTeam(costsRes.items ?? []);
  };

  const costByTeamId = Object.fromEntries(
    costsByTeam.map((c) => [c.groupKey, c.totalCostUsd])
  );

  return (
    <div className="p-6 space-y-8">
      <h1>Cost Attribution &amp; Budgets</h1>
      <p className="muted">
        Per-team and per-agent budgets with hard caps. Set budgets below; when exceeded, proxy returns 429.
      </p>

      <section className="table-card">
        <h2>Team budgets (monthly)</h2>
        {loading ? (
          <p className="muted">Loading…</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Team</th>
                <th>Spend</th>
                <th>Budget</th>
                <th>Utilization</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {teamBudgets.length === 0 && (
                <tr>
                  <td colSpan={5} className="muted">
                    No team budgets set. Use the form below to add one.
                  </td>
                </tr>
              )}
              {teamBudgets.map((b) => {
                const pct = b.monthlyBudgetUsd > 0 ? (b.currentSpendUsd / b.monthlyBudgetUsd) * 100 : 0;
                const exceeded = pct >= 100 && b.hardCap;
                return (
                  <tr key={b.id}>
                    <td>{b.teamId}</td>
                    <td>${b.currentSpendUsd.toFixed(2)}</td>
                    <td>${b.monthlyBudgetUsd.toFixed(2)}</td>
                    <td>
                      <Bar pct={pct} exceeded={exceeded} />
                      <span className="muted" style={{ fontSize: "0.85rem" }}> {pct.toFixed(0)}%</span>
                    </td>
                    <td>{b.status}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section className="table-card">
        <h2>Cost by team (from proxy logs)</h2>
        {loading ? null : (
          <table>
            <thead>
              <tr>
                <th>Team</th>
                <th>Total cost (USD)</th>
                <th>Requests</th>
              </tr>
            </thead>
            <tbody>
              {costsByTeam.length === 0 && (
                <tr>
                  <td colSpan={3} className="muted">No cost data yet.</td>
                </tr>
              )}
              {costsByTeam.map((c) => (
                <tr key={c.groupKey}>
                  <td>{c.groupKey}</td>
                  <td>${c.totalCostUsd.toFixed(4)}</td>
                  <td>{c.requestCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="table-card">
        <h2>Set budget</h2>
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "flex-end" }}>
          <label>
            Type{" "}
            <select
              value={setBudgetType}
              onChange={(e) => setSetBudgetType(e.target.value as "team" | "agent")}
            >
              <option value="team">Team (monthly USD)</option>
              <option value="agent">Agent (daily USD)</option>
            </select>
          </label>
          <label>
            {setBudgetType === "team" ? "Team ID" : "Agent ID"}{" "}
            <input
              type="text"
              value={setBudgetId}
              onChange={(e) => setSetBudgetId(e.target.value)}
              placeholder={setBudgetType === "team" ? "e.g. team-a" : "e.g. agent-1"}
            />
          </label>
          <label>
            Amount (USD){" "}
            <input
              type="number"
              min="0"
              step="0.01"
              value={setBudgetAmount}
              onChange={(e) => setSetBudgetAmount(e.target.value)}
              placeholder={setBudgetType === "team" ? "100" : "5"}
            />
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="checkbox"
              checked={setBudgetHardCap}
              onChange={(e) => setSetBudgetHardCap(e.target.checked)}
            />
            Hard cap (block when exceeded)
          </label>
          <button type="button" onClick={handleSetBudget}>
            Set budget
          </button>
        </div>
      </section>

    </div>
  );
}
