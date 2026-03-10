import type { AgentRecord, ApprovalRecord, AuditEvent } from "./types";

export const mockAgents: AgentRecord[] = [
  {
    id: "agent-support-01",
    name: "Support Agent",
    owner: "support-platform@company.test",
    sponsor: "Head of Support",
    status: "active",
    allowedTools: ["crm.read", "ticket.write", "email.draft"],
    allowedDataScopes: ["tickets", "customer_profile_limited"],
    description: "Handles low-risk support workflows and prepares drafts.",
  },
  {
    id: "agent-ops-01",
    name: "Ops Agent",
    owner: "ops-platform@company.test",
    sponsor: "VP Operations",
    status: "draft",
    allowedTools: ["inventory.read", "approval.request"],
    allowedDataScopes: ["inventory", "shipment_status"],
    description: "Monitors inventory and requests approvals for risky actions.",
  },
];

export const mockApprovals: ApprovalRecord[] = [
  {
    id: "approval-1001",
    agentId: "agent-support-01",
    title: "Send external refund confirmation email",
    status: "pending",
    requestedBy: "support-platform@company.test",
  },
  {
    id: "approval-1002",
    agentId: "agent-ops-01",
    title: "Update inventory allocation threshold",
    status: "approved",
    requestedBy: "ops-platform@company.test",
    approvedBy: "ops-manager@company.test",
  },
];

export const mockAuditEvents: AuditEvent[] = [
  {
    id: "event-2001",
    agentId: "agent-support-01",
    type: "policy.evaluated",
    timestamp: "2026-03-10T09:00:00.000Z",
    summary: "Refund email flagged as high-risk and routed to approval.",
  },
  {
    id: "event-2002",
    agentId: "agent-ops-01",
    type: "approval.resolved",
    timestamp: "2026-03-10T09:15:00.000Z",
    summary: "Inventory threshold change approved by ops manager.",
  },
];
