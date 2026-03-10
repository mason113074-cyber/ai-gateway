import { mockAgents } from "@agent-control-tower/domain";

export default function AgentsPage() {
  return (
    <main>
      <h1>Agents</h1>
      <p className="muted">Every agent needs an owner, sponsor, and clear tool scope.</p>
      <section className="table-card">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th>Owner</th>
              <th>Allowed tools</th>
            </tr>
          </thead>
          <tbody>
            {mockAgents.map((agent) => (
              <tr key={agent.id}>
                <td>
                  <strong>{agent.name}</strong>
                  <div className="muted">{agent.description}</div>
                </td>
                <td>{agent.status}</td>
                <td>{agent.owner}</td>
                <td>{agent.allowedTools.join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
