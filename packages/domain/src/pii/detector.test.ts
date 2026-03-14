import { describe, it, expect } from "vitest";
import {
  detectPii,
  redactText,
  extractPromptText,
  redactRequestBody,
  type PiiDetectorConfig,
} from "./detector.js";

const ALL_TYPES: PiiDetectorConfig = {
  enabledTypes: [
    "email",
    "phone",
    "ssn",
    "credit_card",
    "ip_address",
    "api_key",
  ],
  action: "redact",
};

describe("PII Detector", () => {
  describe("email detection", () => {
    it("detects standard email", () => {
      const matches = detectPii(
        "Contact user@example.com for info",
        ALL_TYPES
      );
      expect(matches).toHaveLength(1);
      expect(matches[0].type).toBe("email");
      expect(matches[0].value).toBe("user@example.com");
    });

    it("detects emails with subdomains", () => {
      const matches = detectPii(
        "Send to admin@mail.corp.co.uk",
        ALL_TYPES
      );
      expect(matches).toHaveLength(1);
      expect(matches[0].type).toBe("email");
    });
  });

  describe("phone detection", () => {
    it("detects US phone with dashes", () => {
      const matches = detectPii("Call 555-123-4567", ALL_TYPES);
      expect(matches).toHaveLength(1);
      expect(matches[0].type).toBe("phone");
    });

    it("detects phone with +1 prefix", () => {
      const matches = detectPii("Number: +1-555-123-4567", ALL_TYPES);
      expect(matches).toHaveLength(1);
      expect(matches[0].type).toBe("phone");
    });

    it("ignores short number sequences", () => {
      const matches = detectPii("Order #12345", {
        ...ALL_TYPES,
        enabledTypes: ["phone"],
      });
      expect(matches).toHaveLength(0);
    });
  });

  describe("SSN detection", () => {
    it("detects SSN with dashes", () => {
      const matches = detectPii("SSN: 123-45-6789", ALL_TYPES);
      expect(matches).toHaveLength(1);
      expect(matches[0].type).toBe("ssn");
    });

    it("rejects invalid SSN starting with 000", () => {
      const matches = detectPii("Number: 000-12-3456", {
        ...ALL_TYPES,
        enabledTypes: ["ssn"],
      });
      expect(matches).toHaveLength(0);
    });

    it("rejects invalid SSN starting with 666", () => {
      const matches = detectPii("Number: 666-12-3456", {
        ...ALL_TYPES,
        enabledTypes: ["ssn"],
      });
      expect(matches).toHaveLength(0);
    });
  });

  describe("credit card detection", () => {
    it("detects Visa card number", () => {
      const matches = detectPii("Card: 4111 1111 1111 1111", ALL_TYPES);
      expect(matches).toHaveLength(1);
      expect(matches[0].type).toBe("credit_card");
    });

    it("rejects invalid Luhn", () => {
      const matches = detectPii("Number: 1234 5678 9012 3456", {
        ...ALL_TYPES,
        enabledTypes: ["credit_card"],
      });
      expect(matches).toHaveLength(0);
    });
  });

  describe("IP address detection", () => {
    it("detects valid IP", () => {
      const matches = detectPii("Server: 192.168.1.100", ALL_TYPES);
      expect(matches).toHaveLength(1);
      expect(matches[0].type).toBe("ip_address");
    });

    it("skips localhost and broadcast", () => {
      const matches = detectPii("Host: 127.0.0.1 and 0.0.0.0", {
        ...ALL_TYPES,
        enabledTypes: ["ip_address"],
      });
      expect(matches).toHaveLength(0);
    });
  });

  describe("API key detection", () => {
    it("detects OpenAI key pattern", () => {
      const matches = detectPii(
        "Key: sk-abc123def456ghi789jkl012mno345p",
        ALL_TYPES
      );
      expect(matches).toHaveLength(1);
      expect(matches[0].type).toBe("api_key");
    });

    it("detects GitHub PAT", () => {
      const matches = detectPii(
        "Token: ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij",
        ALL_TYPES
      );
      expect(matches).toHaveLength(1);
      expect(matches[0].type).toBe("api_key");
    });

    it("detects gateway key pattern", () => {
      const matches = detectPii(
        "Key: gw-a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4",
        ALL_TYPES
      );
      expect(matches).toHaveLength(1);
      expect(matches[0].type).toBe("api_key");
    });
  });

  describe("no false positives", () => {
    it("does not flag normal text", () => {
      const matches = detectPii(
        "The quick brown fox jumps over the lazy dog.",
        ALL_TYPES
      );
      expect(matches).toHaveLength(0);
    });

    it("handles empty text", () => {
      const matches = detectPii("", ALL_TYPES);
      expect(matches).toHaveLength(0);
    });
  });

  describe("redactText", () => {
    it("replaces all PII", () => {
      const text = "Email user@test.com and call 555-123-4567";
      const matches = detectPii(text, ALL_TYPES);
      const redacted = redactText(text, matches);
      expect(redacted).not.toContain("user@test.com");
      expect(redacted).not.toContain("555-123-4567");
      expect(redacted).toContain("[EMAIL_REDACTED]");
      expect(redacted).toContain("[PHONE_REDACTED]");
    });

    it("preserves non-PII content", () => {
      const text = "Hello world, email: test@example.com, thanks!";
      const matches = detectPii(text, ALL_TYPES);
      const redacted = redactText(text, matches);
      expect(redacted).toContain("Hello world");
      expect(redacted).toContain("thanks!");
    });
  });

  describe("extractPromptText", () => {
    it("extracts from OpenAI format", () => {
      const body = JSON.stringify({
        model: "gpt-4",
        messages: [
          { role: "system", content: "You are helpful" },
          { role: "user", content: "Hello user@test.com" },
        ],
      });
      const text = extractPromptText(body);
      expect(text).toContain("You are helpful");
      expect(text).toContain("user@test.com");
    });

    it("extracts from Anthropic format", () => {
      const body = JSON.stringify({
        model: "claude-3",
        system: "Be helpful",
        messages: [{ role: "user", content: "Check 555-123-4567" }],
      });
      const text = extractPromptText(body);
      expect(text).toContain("Be helpful");
      expect(text).toContain("555-123-4567");
    });
  });

  describe("redactRequestBody", () => {
    it("redacts PII in OpenAI message content", () => {
      const body = JSON.stringify({
        model: "gpt-4",
        messages: [{ role: "user", content: "Email is user@test.com" }],
      });
      const matches = detectPii(extractPromptText(body), ALL_TYPES);
      const redacted = redactRequestBody(body, matches);
      const parsed = JSON.parse(redacted) as {
        messages: Array<{ content: string }>;
        model: string;
      };
      expect(parsed.messages[0].content).toContain("[EMAIL_REDACTED]");
      expect(parsed.messages[0].content).not.toContain("user@test.com");
      expect(parsed.model).toBe("gpt-4");
    });
  });
});
