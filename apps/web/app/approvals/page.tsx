import { mockApprovals } from "@agent-control-tower/domain";

export default function ApprovalsPage() {
  return (
    <main>
      <h1>Approvals</h1>
      <p className="muted">High-risk operations stop here before they touch real systems.</p>
      <section className="table-card">
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Status</th>
              <th>Requested by</th>
              <th>Approved by</th>
            </tr>
          </thead>
          <tbody>
            {mockApprovals.map((approval) => (
              <tr key={approval.id}>
                <td>{approval.title}</td>
                <td>{approval.status}</td>
                <td>{approval.requestedBy}</td>
                <td>{approval.approvedBy ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
