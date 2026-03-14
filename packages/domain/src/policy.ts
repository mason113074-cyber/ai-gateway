import type { ActionRequest, PolicyDecision, PolicyVerdict } from "./types";

export function evaluatePolicy(action: ActionRequest): PolicyDecision {
  const reasons: string[] = [];
  let requiresApproval = false;
  let riskLevel: PolicyDecision["riskLevel"] = "low";

  if (action.actionType === "delete" && action.external) {
    reasons.push("External delete operations are not permitted.");
    const rationale = reasons.join(" ");
    return {
      verdict: "deny",
      riskLevel: "high",
      requiresApproval: true,
      reasons,
      rationale,
    };
  }

  if (action.actionType === "delete") {
    riskLevel = "high";
    requiresApproval = true;
    reasons.push("Delete actions are always high risk.");
  }

  if (action.actionType === "refund") {
    riskLevel = "high";
    requiresApproval = true;
    reasons.push("Refund actions require human approval.");
  }

  if (action.amount && action.amount >= 1000) {
    riskLevel = "high";
    requiresApproval = true;
    reasons.push("High-value operations require approval.");
  }

  if (action.external && action.actionType === "email") {
    riskLevel = "high";
    requiresApproval = true;
    reasons.push("External emails require approval.");
  }

  if (action.containsPii && action.actionType !== "read") {
    riskLevel = "high";
    requiresApproval = true;
    reasons.push("PII changes require approval.");
  }

  if (!requiresApproval && action.actionType === "write") {
    riskLevel = "medium";
    reasons.push("Write operations should be logged and reviewed if needed.");
  }

  if (!requiresApproval && reasons.length === 0) {
    reasons.push("Operation falls within baseline allowed policy.");
  }

  const verdict: PolicyVerdict =
    riskLevel === "high" && requiresApproval ? "requires_approval" : "allow";
  const rationale = reasons.join(" ");

  return {
    verdict,
    riskLevel,
    requiresApproval,
    reasons,
    rationale,
  };
}
