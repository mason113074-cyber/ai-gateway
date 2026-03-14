import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

type Stats = {
  totalRequests: number;
  totalCostUsd: number;
  totalTokens: number;
  byModel: Record<
    string,
    { requests: number; costUsd: number; tokens: number }
  >;
};

async function getStats(): Promise<Stats | null> {
  try {
    const res = await fetch(`${API_BASE}/api/stats`, {
      cache: "no-store",
      headers: { "x-workspace-id": "default" },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function DashboardPage() {
  const stats = await getStats();

  return (
    <main>
      <h1>Cost dashboard</h1>
      <p className="muted">Usage and cost by agent and model.</p>

      {!stats ? (
        <p className="muted">No stats yet. Send requests through the proxy to see data.</p>
      ) : (
        <>
          <section className="card-grid">
            <article className="card">
              <h2>${stats.totalCostUsd.toFixed(4)}</h2>
              <p className="muted">Total spend (USD)</p>
            </article>
            <article className="card">
              <h2>{stats.totalRequests}</h2>
              <p className="muted">Total requests</p>
            </article>
            <article className="card">
              <h2>{stats.totalTokens.toLocaleString()}</h2>
              <p className="muted">Total tokens</p>
            </article>
          </section>

          <section className="table-card" style={{ marginTop: 24 }}>
            <h2>By model</h2>
            <table>
              <thead>
                <tr>
                  <th>Model</th>
                  <th>Requests</th>
                  <th>Tokens</th>
                  <th>Cost (USD)</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(stats.byModel).map(([model, data]) => (
                  <tr key={model}>
                    <td>{model}</td>
                    <td>{data.requests}</td>
                    <td>{data.tokens.toLocaleString()}</td>
                    <td>${data.costUsd.toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}

      <p style={{ marginTop: 24 }}>
        <Link href="/">← Overview</Link>
        {" · "}
        <Link href="/logs">Logs</Link>
        {" · "}
        <Link href="/agents">Agents</Link>
      </p>
    </main>
  );
}
