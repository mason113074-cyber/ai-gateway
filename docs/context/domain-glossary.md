# Domain glossary

- **Agent**: An AI actor (e.g. bot, assistant) that performs actions on behalf of a user or system; identified and governed by the control tower.
- **Registry**: Catalog of agents (identity, owner, metadata).
- **Policy**: Rules that determine allow/deny/requires_approval for agent actions (tools, data scopes).
- **Approval workflow**: Flow for risky actions: request → review → approve/reject.
- **Audit event**: Immutable record of a state change or significant action for traceability.
- **Trace**: Sequence of steps/spans for an agent run; used for replay and investigation.
- **Workspace**: Tenant or organizational boundary (future multi-tenancy).
- **Control plane**: This product—governance, policy, approval, audit—as opposed to the data plane (actual agent execution).
