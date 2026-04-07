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

  it("uses claude pricing for unknown claude versioned model", () => {
    const cost = estimateCost("claude-3-7-sonnet-20250219", 1000, 1000);
    const expected =
      (1000 / 1000) * MODEL_COSTS["claude-3-5-sonnet"].input +
      (1000 / 1000) * MODEL_COSTS["claude-3-5-sonnet"].output;
    expect(cost).toBeCloseTo(expected);
  });

  it("uses gpt-4o pricing for unknown gpt model", () => {
    const cost = estimateCost("gpt-5-turbo", 1000, 1000);
    const expected =
      (1000 / 1000) * MODEL_COSTS["gpt-4o"].input +
      (1000 / 1000) * MODEL_COSTS["gpt-4o"].output;
    expect(cost).toBeCloseTo(expected);
  });

  it("uses exact entry for versioned claude model in table", () => {
    const cost = estimateCost("claude-3-5-sonnet-20241022", 1000, 500);
    const expected =
      (1000 / 1000) * MODEL_COSTS["claude-3-5-sonnet-20241022"].input +
      (500 / 1000) * MODEL_COSTS["claude-3-5-sonnet-20241022"].output;
    expect(cost).toBeCloseTo(expected);
  });
});
