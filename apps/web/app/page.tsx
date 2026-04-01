import Link from "next/link";

const API_BASE = "/api/gateway";

async function getOverviewStats(): Promise<{
  agentCount: number;
  totalRequests: number;
  totalCostUsd: number;
}> {
  try {
    const [agentsRes, statsRes] = await Promise.all([
      fetch(`${API_BASE}/agents`, { cache: "no-store" }),
      fetch(`${API_BASE}/stats`, { cache: "no-store" }),
    ]);
    const agents = agentsRes.ok ? ((await agentsRes.json()) as { items: unknown[] }).items?.length ?? 0 : 0;
    const stats = statsRes.ok ? (await statsRes.json()) as { totalRequests: number; totalCostUsd: number } : { totalRequests: 0, totalCostUsd: 0 };
    return {
      agentCount: agents,
      totalRequests: stats.totalRequests ?? 0,
      totalCostUsd: stats.totalCostUsd ?? 0,
    };
  } catch {
    return { agentCount: 0, totalRequests: 0, totalCostUsd: 0 };
  }
}

export default async function HomePage() {
  const { agentCount, totalRequests, totalCostUsd } = await getOverviewStats();

  return (
    <main>
      <h1>AI Gateway</h1>
      <p className="muted">Agent governance control plane — proxy, tag, and govern LLM traffic.</p>

      <section className="card-grid">
        <Link href="/agents" className="card" style={{ textDecoration: "none" }}>
          <h2>{agentCount}</h2>
          <p className="muted">Agents</p>
        </Link>
        <Link href="/dashboard" className="card" style={{ textDecoration: "none" }}>
          <h2>{totalRequests}</h2>
          <p className="muted">Requests</p>
        </Link>
        <Link href="/dashboard" className="card" style={{ textDecoration: "none" }}>
          <h2>${totalCostUsd.toFixed(4)}</h2>
          <p className="muted">Cost (USD)</p>
        </Link>
      </section>

      <nav style={{ marginTop: 24, display: "flex", gap: 16, flexWrap: "wrap" }}>
        <Link href="/dashboard">Dashboard</Link>
        <Link href="/agents">Agents</Link>
        <Link href="/logs">Logs</Link>
      </nav>
    </main>
  );
}
