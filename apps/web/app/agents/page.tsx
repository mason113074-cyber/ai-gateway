import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

type AgentRecord = {
  id: string;
  name: string;
  owner: string;
  sponsor: string;
  status: string;
  allowedTools: string[];
  allowedDataScopes: string[];
  description: string;
};

async function getAgents(): Promise<AgentRecord[]> {
  const res = await fetch(`${API_BASE}/api/agents`, {
    cache: "no-store",
    headers: { "x-workspace-id": "default" },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { items: AgentRecord[] };
  return data.items ?? [];
}

export default async function AgentsPage() {
  const agents = await getAgents();
  const isAutoRegistered = (agent: AgentRecord) =>
    agent.name.startsWith("Auto-registered:");

  return (
    <main>
      <h1>Agents</h1>
      <p className="muted">
        Every agent needs an owner, sponsor, and clear tool scope.
      </p>
      <section className="table-card">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th>Owner</th>
              <th>Allowed Tools</th>
              <th>Last Seen</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {agents.map((agent) => (
              <tr key={agent.id}>
                <td>
                  <strong>{agent.name}</strong>
                  {isAutoRegistered(agent) && (
                    <span className="badge">auto-registered</span>
                  )}
                  <div className="muted">{agent.description}</div>
                </td>
                <td>{agent.status}</td>
                <td>{agent.owner}</td>
                <td>{agent.allowedTools.join(", ") || "—"}</td>
                <td>—</td>
                <td>
                  <Link href={`/agents/${agent.id}/edit`}>Edit</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
