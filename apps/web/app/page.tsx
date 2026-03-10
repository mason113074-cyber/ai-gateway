import { mockAgents, mockApprovals, mockAuditEvents } from "@agent-control-tower/domain";

export default function HomePage() {
  const activeAgents = mockAgents.filter((agent) => agent.status === "active").length;
  const pendingApprovals = mockApprovals.filter((approval) => approval.status === "pending").length;

  return (
    <main>
      <p className="badge">Bootstrap build</p>
      <h1>Agent Control Tower</h1>
      <p className="muted">
        This dashboard is the first scaffold for an enterprise agent governance product.
      </p>

      <section className="card-grid">
        <article className="card">
          <h2>{mockAgents.length}</h2>
          <p className="muted">Registered agents</p>
        </article>
        <article className="card">
          <h2>{activeAgents}</h2>
          <p className="muted">Active agents</p>
        </article>
        <article className="card">
          <h2>{pendingApprovals}</h2>
          <p className="muted">Pending approvals</p>
        </article>
        <article className="card">
          <h2>{mockAuditEvents.length}</h2>
          <p className="muted">Recent audit events</p>
        </article>
      </section>

      <section className="table-card">
        <h2>What comes next</h2>
        <ol>
          <li>Wire real auth and workspace boundaries.</li>
          <li>Persist agent registry and audit events in a database.</li>
          <li>Add policy-based approvals for risky actions.</li>
          <li>Render trace replay and incident review screens.</li>
        </ol>
      </section>
    </main>
  );
}
