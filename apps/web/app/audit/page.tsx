"use client";

import { useEffect, useState } from "react";

const API_BASE = typeof window !== "undefined" ? "" : process.env.NEXT_PUBLIC_API_URL ?? "";

type AuditItem = {
  id: string;
  timestamp: string;
  eventType: string;
  actorType: string;
  actorId: string;
  targetType?: string;
  targetId?: string;
  action: string;
  outcome: string;
  metadata?: Record<string, unknown>;
};

export default function AuditPage() {
  const [items, setItems] = useState<AuditItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [eventType, setEventType] = useState("");
  const [actorId, setActorId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [limit, setLimit] = useState(100);
  const [offset, setOffset] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams();
    if (eventType) params.set("eventType", eventType);
    if (actorId) params.set("actorId", actorId);
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    params.set("limit", String(limit));
    params.set("offset", String(offset));
    setLoading(true);
    fetch(`${API_BASE}/api/audit-logs?${params.toString()}`, {
      headers: { "x-workspace-id": "default" },
    })
      .then((res) => res.json())
      .then((data: { items?: AuditItem[]; total?: number }) => {
        setItems(data.items ?? []);
        setTotal(data.total ?? 0);
      })
      .catch(() => {
        setItems([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, [eventType, actorId, startDate, endDate, limit, offset]);

  const nextPage = () => setOffset((o) => Math.min(o + limit, total));
  const prevPage = () => setOffset((o) => Math.max(0, o - limit));

  return (
    <main>
      <h1>Audit Logs</h1>
      <p className="muted">
        Immutable audit trail: proxy requests, policy decisions, agent changes.
      </p>

      <section className="table-card" style={{ marginBottom: "1rem" }}>
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "1rem" }}>
          <label>
            Event type{" "}
            <select
              value={eventType}
              onChange={(e) => {
                setEventType(e.target.value);
                setOffset(0);
              }}
            >
              <option value="">All</option>
              <option value="proxy.request">proxy.request</option>
              <option value="policy.deny">policy.deny</option>
              <option value="policy.requires_approval">policy.requires_approval</option>
              <option value="agent.created">agent.created</option>
              <option value="agent.updated">agent.updated</option>
              <option value="config.changed">config.changed</option>
              <option value="budget.exceeded">budget.exceeded</option>
            </select>
          </label>
          <label>
            Actor ID{" "}
            <input
              type="text"
              value={actorId}
              onChange={(e) => {
                setActorId(e.target.value);
                setOffset(0);
              }}
              placeholder="Filter by actor"
            />
          </label>
          <label>
            From{" "}
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setOffset(0);
              }}
            />
          </label>
          <label>
            To{" "}
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setOffset(0);
              }}
            />
          </label>
          <label>
            Page size{" "}
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setOffset(0);
              }}
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
            </select>
          </label>
        </div>

        {loading ? (
          <p className="muted">Loading…</p>
        ) : (
          <>
            <table>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Event Type</th>
                  <th>Actor</th>
                  <th>Target</th>
                  <th>Action</th>
                  <th>Outcome</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id}>
                    <td>{row.timestamp}</td>
                    <td>{row.eventType}</td>
                    <td>{row.actorId}</td>
                    <td>{row.targetType ? `${row.targetType}: ${row.targetId ?? ""}` : "—"}</td>
                    <td>{row.action}</td>
                    <td>{row.outcome}</td>
                    <td>
                      <button
                        type="button"
                        onClick={() => setExpandedId(expandedId === row.id ? null : row.id)}
                      >
                        {expandedId === row.id ? "Hide" : "Details"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {items.length === 0 && (
              <p className="muted">No audit events match the filters.</p>
            )}
            {items.map(
              (row) =>
                expandedId === row.id &&
                row.metadata && (
                  <pre
                    key={`detail-${row.id}`}
                    style={{
                      marginTop: "0.5rem",
                      padding: "0.75rem",
                      background: "var(--surface, #f5f5f5)",
                      borderRadius: 4,
                      overflow: "auto",
                      fontSize: "0.85rem",
                    }}
                  >
                    {JSON.stringify(row.metadata, null, 2)}
                  </pre>
                )
            )}

            <div style={{ marginTop: "1rem", display: "flex", alignItems: "center", gap: "1rem" }}>
              <span className="muted">
                {offset + 1}–{Math.min(offset + limit, total)} of {total}
              </span>
              <button type="button" onClick={prevPage} disabled={offset <= 0}>
                Previous
              </button>
              <button type="button" onClick={nextPage} disabled={offset + limit >= total}>
                Next
              </button>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
