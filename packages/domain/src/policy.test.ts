import { describe, expect, it } from "vitest";
import { evaluatePolicy } from "./policy";

describe("evaluatePolicy", () => {
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
