import {
  detectPii,
  extractPromptText,
  redactRequestBody,
  type AuditLogger,
  type PiiDetectorConfig,
} from "@agent-control-tower/domain";
import type { ReplyLike } from "./proxy-types.js";

/**
 * Applies workspace PII guardrail rules to the outbound request body.
 * Returns `responded: true` when the request was blocked with a 400.
 */
export async function applyProxyPiiGuardrail(params: {
  body: string | undefined;
  workspaceId: string;
  agentId: string;
  auditLogger: AuditLogger;
  reply: ReplyLike;
  getPiiConfig: (
    workspaceId: string
  ) => Promise<PiiDetectorConfig & { enabled: boolean }> | (PiiDetectorConfig & { enabled: boolean });
}): Promise<{ body: string | undefined; responded: boolean }> {
  const { workspaceId, agentId, auditLogger, reply, getPiiConfig } = params;
  let body = params.body;

  if (!body) {
    return { body, responded: false };
  }

  const piiConfig = await getPiiConfig(workspaceId);
  if (!piiConfig.enabled) {
    return { body, responded: false };
  }

  const promptText = extractPromptText(body);
  const piiMatches = detectPii(promptText, piiConfig);

  if (piiMatches.length === 0) {
    return { body, responded: false };
  }

  const piiSummary = piiMatches.map((m) => m.type);

  if (piiConfig.action === "block") {
    await auditLogger.log(workspaceId, {
      eventType: "guardrail.pii_blocked",
      actorType: "agent",
      actorId: agentId,
      targetType: "guardrail",
      targetId: "pii_redaction",
      action: "proxy.request",
      outcome: "denied",
      metadata: { piiTypes: piiSummary, count: piiMatches.length },
    });
    reply.status(400).send({
      error: "PII detected in prompt",
      piiTypes: piiSummary,
      message:
        "Request blocked: personally identifiable information detected. Configure redaction to auto-clean prompts.",
    });
    return { body, responded: true };
  }

  if (piiConfig.action === "redact") {
    body = redactRequestBody(body, piiMatches);
    await auditLogger.log(workspaceId, {
      eventType: "guardrail.pii_redacted",
      actorType: "system",
      actorId: "pii-guardrail",
      targetType: "guardrail",
      targetId: "pii_redaction",
      action: "redact",
      outcome: "success",
      metadata: { piiTypes: piiSummary, count: piiMatches.length },
    });
  }

  if (piiConfig.action === "warn") {
    await auditLogger.log(workspaceId, {
      eventType: "guardrail.pii_warning",
      actorType: "system",
      actorId: "pii-guardrail",
      targetType: "guardrail",
      targetId: "pii_redaction",
      action: "warn",
      outcome: "success",
      metadata: { piiTypes: piiSummary, count: piiMatches.length },
    });
  }

  return { body, responded: false };
}
