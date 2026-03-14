export type RiskLevel = "low" | "medium" | "high";
export type AgentStatus = "draft" | "active" | "disabled";
export type ApprovalStatus = "pending" | "approved" | "rejected";

export interface AgentRecord {
  id: string;
  name: string;
  owner: string;
  sponsor: string;
  status: AgentStatus;
  allowedTools: string[];
  allowedDataScopes: string[];
  description: string;
}

export interface ActionRequest {
  actionType: "read" | "write" | "delete" | "refund" | "email";
  target: string;
  external: boolean;
  amount?: number;
  containsPii?: boolean;
}

export type PolicyVerdict = "allow" | "deny" | "requires_approval";

export interface PolicyDecision {
  verdict: PolicyVerdict;
  riskLevel: RiskLevel;
  requiresApproval: boolean;
  reasons: string[];
  rationale: string;
}

export interface ApprovalRecord {
  id: string;
  agentId: string;
  title: string;
  status: ApprovalStatus;
  requestedBy: string;
  approvedBy?: string;
}

export interface AuditEvent {
  id: string;
  agentId: string;
  type: string;
  timestamp: string;
  summary: string;
}
