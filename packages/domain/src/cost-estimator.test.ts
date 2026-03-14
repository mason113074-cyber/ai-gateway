import { describe, it, expect } from "vitest";
import { estimateCost, MODEL_COSTS } from "./cost-estimator";

describe("estimateCost", () => {
  it("should calculate cost for known model", () => {
    const cost = estimateCost("gpt-4o", 1000, 500);
    expect(cost).toBeCloseTo(0.0025 + 0.005);
  });

  it("should fallback to gpt-4o for unknown model", () => {
    const cost = estimateCost("unknown-model", 1000, 1000);
    const expected =
      (1000 / 1000) * MODEL_COSTS["gpt-4o"].input +
      (1000 / 1000) * MODEL_COSTS["gpt-4o"].output;
    expect(cost).toBeCloseTo(expected);
  });

  it("should handle zero tokens", () => {
    expect(estimateCost("gpt-4o", 0, 0)).toBe(0);
  });
});
