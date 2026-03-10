import { mockAuditEvents } from "@agent-control-tower/domain";

export default function AuditPage() {
  return (
    <main>
      <h1>Audit</h1>
      <p className="muted">If an agent causes trouble, this page should explain exactly what happened.</p>
      <section className="table-card">
        <table>
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Agent</th>
              <th>Type</th>
              <th>Summary</th>
            </tr>
          </thead>
          <tbody>
            {mockAuditEvents.map((event) => (
              <tr key={event.id}>
                <td>{event.timestamp}</td>
                <td>{event.agentId}</td>
                <td>{event.type}</td>
                <td>{event.summary}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
