import { describe, expect, it } from "vitest";
import { evaluatePolicy } from "./policy";

describe("evaluatePolicy", () => {
  it("returns verdict allow for read operations", () => {
    const result = evaluatePolicy({
      actionType: "read",
      target: "ticket",
      external: false,
    });

    expect(result.verdict).toBe("allow");
    expect(result.riskLevel).toBe("low");
    expect(result.requiresApproval).toBe(false);
    expect(result.rationale).toBeDefined();
    expect(result.rationale.length).toBeGreaterThan(0);
  });

  it("returns verdict requires_approval for high-risk write", () => {
    const result = evaluatePolicy({
      actionType: "delete",
      target: "customer-record",
      external: false,
    });

    expect(result.verdict).toBe("requires_approval");
    expect(result.riskLevel).toBe("high");
    expect(result.requiresApproval).toBe(true);
    expect(result.rationale).toContain("Delete actions");
  });

  it("returns verdict deny for external delete", () => {
    const result = evaluatePolicy({
      actionType: "delete",
      target: "resource",
      external: true,
    });

    expect(result.verdict).toBe("deny");
    expect(result.rationale).toContain("External delete operations are not permitted");
  });

  it("flags delete actions as high risk", () => {
    const result = evaluatePolicy({
      actionType: "delete",
      target: "customer-record",
      external: false,
    });

    expect(result.riskLevel).toBe("high");
    expect(result.requiresApproval).toBe(true);
  });

  it("keeps basic read actions low risk", () => {
    const result = evaluatePolicy({
      actionType: "read",
      target: "ticket",
      external: false,
    });

    expect(result.riskLevel).toBe("low");
    expect(result.requiresApproval).toBe(false);
  });

  it("flags external email as approval required", () => {
    const result = evaluatePolicy({
      actionType: "email",
      target: "customer",
      external: true,
    });

    expect(result.requiresApproval).toBe(true);
    expect(result.reasons.join(" ")).toContain("External emails");
  });
});
