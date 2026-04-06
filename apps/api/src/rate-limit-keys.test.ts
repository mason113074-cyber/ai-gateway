import { describe, expect, it } from "vitest";
import {
  rateLimitWindowKeyAgent,
  rateLimitWindowKeyGlobal,
  rateLimitWindowKeyTeam,
} from "./rate-limit-keys.js";

describe("rateLimitWindowKey*", () => {
  it("uses workspace-scoped global key (matches proxy + status)", () => {
    expect(rateLimitWindowKeyGlobal("acme")).toBe("global:acme");
  });

  it("uses workspace+team key", () => {
    expect(rateLimitWindowKeyTeam("acme", "sales")).toBe("team:acme:sales");
  });

  it("uses workspace+agent key to avoid cross-workspace collisions", () => {
    expect(rateLimitWindowKeyAgent("acme", "bot-1")).toBe("agent:acme:bot-1");
    expect(rateLimitWindowKeyAgent("other", "bot-1")).toBe("agent:other:bot-1");
  });
});
