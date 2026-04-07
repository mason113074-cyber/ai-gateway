/**
 * PII Detection Engine — regex-based, zero external dependencies.
 * Detects: email, phone, SSN, credit card (with Luhn check), IP address, API keys.
 */

export type PiiType =
  | "email"
  | "phone"
  | "ssn"
  | "credit_card"
  | "ip_address"
  | "api_key";

export interface PiiMatch {
  type: PiiType;
  value: string;
  start: number;
  end: number;
  replacement: string;
}

export interface PiiDetectorConfig {
  enabledTypes: PiiType[];
  action: "redact" | "warn" | "block";
}

// ── Luhn Check (credit card validation) ──────────────────────
function luhnCheck(numStr: string): boolean {
  const digits = numStr.replace(/\D/g, "");
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let isEven = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits[i], 10);
    if (isEven) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    isEven = !isEven;
  }
  return sum % 10 === 0;
}

// ── Regex Patterns ───────────────────────────────────────────
const PII_PATTERNS: Record<
  PiiType,
  { regex: RegExp; replacement: string; validate?: (match: string) => boolean }
> = {
  email: {
    regex: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g,
    replacement: "[EMAIL_REDACTED]",
  },
  phone: {
    regex: /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/g,
    replacement: "[PHONE_REDACTED]",
    validate: (m) => m.replace(/\D/g, "").length >= 10,
  },
  ssn: {
    regex: /\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b/g,
    replacement: "[SSN_REDACTED]",
    validate: (m) => {
      const digits = m.replace(/\D/g, "");
      if (digits.length !== 9) return false;
      const area = parseInt(digits.slice(0, 3), 10);
      if (area === 0 || area === 666 || area >= 900) return false;
      if (digits.slice(3, 5) === "00") return false;
      if (digits.slice(5, 9) === "0000") return false;
      return true;
    },
  },
  credit_card: {
    regex: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
    replacement: "[CREDIT_CARD_REDACTED]",
    validate: (m) => luhnCheck(m),
  },
  ip_address: {
    regex:
      /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g,
    replacement: "[IP_REDACTED]",
    validate: (m) => {
      if (m === "0.0.0.0" || m === "127.0.0.1" || m === "255.255.255.255")
        return false;
      return true;
    },
  },
  api_key: {
    regex:
      /\b(?:sk-[a-zA-Z0-9]{20,}|ghp_[a-zA-Z0-9]{36}|gw-[a-f0-9]{32}|AKIA[0-9A-Z]{16}|xox[baprs]-[a-zA-Z0-9-]{10,}|SG\.[a-zA-Z0-9_-]{22}\.[a-zA-Z0-9_-]{43})\b/g,
    replacement: "[API_KEY_REDACTED]",
  },
};

// ── Main Detection Function ──────────────────────────────────
export function detectPii(
  text: string,
  config: PiiDetectorConfig
): PiiMatch[] {
  const matches: PiiMatch[] = [];

  for (const type of config.enabledTypes) {
    const pattern = PII_PATTERNS[type];
    if (!pattern) continue;

    const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      const value = match[0];
      if (pattern.validate && !pattern.validate(value)) continue;

      matches.push({
        type,
        value,
        start: match.index,
        end: match.index + value.length,
        replacement: pattern.replacement,
      });
    }
  }

  matches.sort((a, b) => a.start - b.start);

  const deduped: PiiMatch[] = [];
  for (const m of matches) {
    const last = deduped[deduped.length - 1];
    if (last && m.start < last.end) continue;
    deduped.push(m);
  }

  return deduped;
}

// ── Redaction Function ───────────────────────────────────────
export function redactText(text: string, matches: PiiMatch[]): string {
  let result = text;
  for (const match of [...matches].sort((a, b) => b.start - a.start)) {
    result =
      result.slice(0, match.start) +
      match.replacement +
      result.slice(match.end);
  }
  return result;
}

// ── Request Body Helpers ─────────────────────────────────────
/** Extract all prompt text from OpenAI or Anthropic request body */
export function extractPromptText(bodyStr: string): string {
  try {
    const body = JSON.parse(bodyStr) as Record<string, unknown>;
    const texts: string[] = [];

    if (Array.isArray(body.messages)) {
      for (const msg of body.messages as Array<{
        content?: string | Array<{ type?: string; text?: string }>;
      }>) {
        if (typeof msg.content === "string") {
          texts.push(msg.content);
        } else if (Array.isArray(msg.content)) {
          for (const part of msg.content) {
            if (
              part.type === "text" &&
              typeof (part as { text?: string }).text === "string"
            ) {
              texts.push((part as { text: string }).text);
            }
          }
        }
      }
    }

    if (typeof body.prompt === "string") {
      texts.push(body.prompt);
    }
    if (typeof body.system === "string") {
      texts.push(body.system);
    }

    return texts.join("\n");
  } catch {
    return bodyStr;
  }
}

/** Redact PII in request body JSON (modifies message content fields) */
export function redactRequestBody(
  bodyStr: string,
  matches: PiiMatch[]
): string {
  try {
    const body = JSON.parse(bodyStr) as Record<string, unknown>;
    const replacements = new Map<string, string>();
    for (const match of matches) {
      replacements.set(match.value, match.replacement);
    }

    function redactString(s: string): string {
      let result = s;
      for (const [original, replacement] of replacements) {
        result = result.split(original).join(replacement);
      }
      return result;
    }

    if (Array.isArray(body.messages)) {
      for (const msg of body.messages as Array<{
        content?: string | Array<{ type?: string; text?: string }>;
      }>) {
        if (typeof msg.content === "string") {
          msg.content = redactString(msg.content);
        } else if (Array.isArray(msg.content)) {
          for (const part of msg.content) {
            if (
              part.type === "text" &&
              typeof (part as { text?: string }).text === "string"
            ) {
              (part as { text: string }).text = redactString(
                (part as { text: string }).text
              );
            }
          }
        }
      }
    }
    if (typeof body.prompt === "string") {
      body.prompt = redactString(body.prompt);
    }
    if (typeof body.system === "string") {
      body.system = redactString(body.system);
    }

    return JSON.stringify(body);
  } catch {
    return redactText(bodyStr, matches);
  }
}

// ── Default Config ───────────────────────────────────────────
export const DEFAULT_PII_CONFIG: PiiDetectorConfig = {
  enabledTypes: ["email", "phone", "ssn", "credit_card", "api_key"],
  action: "warn",
};
