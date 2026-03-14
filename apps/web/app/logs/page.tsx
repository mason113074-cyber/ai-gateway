import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

type LogEntry = {
  id: string;
  timestamp: string;
  agentId: string;
  teamId: string;
  model: string;
  totalTokens: number | null;
  costUsd: number | null;
  latencyMs: number;
  statusCode: number;
  error: string | null;
};

async function getLogs(limit = 100): Promise<LogEntry[]> {
  try {
    const res = await fetch(
      `${API_BASE}/api/logs?limit=${limit}`,
      { cache: "no-store", headers: { "x-workspace-id": "default" } }
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { items: LogEntry[] };
    return data.items ?? [];
  } catch {
    return [];
  }
}

export default async function LogsPage() {
  const logs = await getLogs();

  return (
    <main>
      <h1>Request logs</h1>
      <p className="muted">Proxy request history. Filter by agent or team via API query params.</p>

      <section className="table-card" style={{ marginTop: 16 }}>
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Agent</th>
              <th>Team</th>
              <th>Model</th>
              <th>Tokens</th>
              <th>Cost</th>
              <th>Latency</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan={8} className="muted">
                  No logs yet. Send requests through the proxy to see data.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id}>
                  <td>{new Date(log.timestamp).toLocaleString()}</td>
                  <td>{log.agentId}</td>
                  <td>{log.teamId}</td>
                  <td>{log.model}</td>
                  <td>{log.totalTokens ?? "—"}</td>
                  <td>{log.costUsd != null ? `$${log.costUsd.toFixed(4)}` : "—"}</td>
                  <td>{log.latencyMs}ms</td>
                  <td>{log.error ? "error" : log.statusCode}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <p style={{ marginTop: 24 }}>
        <Link href="/">← Overview</Link>
        {" · "}
        <Link href="/dashboard">Dashboard</Link>
        {" · "}
        <Link href="/agents">Agents</Link>
      </p>
    </main>
  );
}
