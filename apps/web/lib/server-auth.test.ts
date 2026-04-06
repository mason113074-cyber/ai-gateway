import { afterEach, describe, expect, it } from "vitest";
import { getGatewayApiBaseUrl } from "./server-auth.js";

const saved = { ...process.env };

afterEach(() => {
  process.env = { ...saved };
});

describe("getGatewayApiBaseUrl", () => {
  it("prefers GATEWAY_INTERNAL_API_URL over NEXT_PUBLIC_API_BASE_URL", () => {
    process.env.GATEWAY_INTERNAL_API_URL = "http://internal:4000";
    process.env.NEXT_PUBLIC_API_BASE_URL = "http://ignored:4000";
    expect(getGatewayApiBaseUrl()).toBe("http://internal:4000");
  });

  it("falls back to NEXT_PUBLIC_API_BASE_URL when internal URL is unset", () => {
    delete process.env.GATEWAY_INTERNAL_API_URL;
    process.env.NEXT_PUBLIC_API_BASE_URL = "http://public:4000";
    expect(getGatewayApiBaseUrl()).toBe("http://public:4000");
  });

  it("defaults to localhost when no env is set", () => {
    delete process.env.GATEWAY_INTERNAL_API_URL;
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
    expect(getGatewayApiBaseUrl()).toBe("http://localhost:4000");
  });
});
