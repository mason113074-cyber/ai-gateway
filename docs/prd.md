# Product Requirements Document — AI Gateway

## Product name
AI Gateway — Agent Governance Control Plane

## Problem
Companies increasingly use AI agents to read data, call tools, draft emails, and change records.
The blocker is not only intelligence. The blocker is trust:
- who is this agent?
- what can it access?
- what did it do?
- who approved risky actions?
- how do we investigate incidents?
- how much is it costing us?

## Target user
- Series B/C fintech or CX SaaS companies
- 20-200 person engineering teams
- Internal AI platform teams
- Security and governance teams

## Core jobs to be done
1. Proxy all LLM calls through a single gateway (one-line integration).
2. Tag every request with agent identity (x-agent-id, x-team-id).
3. Track cost per agent, per team, per model in real time.
4. Evaluate policy before risky actions (allow / deny / requires_approval).
5. Enforce budgets with atomic transactions.
6. Detect and handle PII in prompts/responses.
7. Preserve immutable audit evidence for compliance.
8. Route risky actions to human approval.

## MVP scope (Phases 1-4, completed)
- LLM proxy with streaming SSE passthrough
- Agent identity tagging via headers
- Agent registry with auto-register on first request
- Policy engine (allow / deny / requires_approval)
- Cost dashboard and log viewer
- Admin console (Next.js)

## Revenue-critical features (Phases 5-10)
- Persistent storage with SQLite + audit logs
- Per-agent budget enforcement
- PII detection (redact / warn / block)
- RBAC + API key management (SSO-ready)
- Multi-provider router (OpenAI + Anthropic + Azure)
- Compliance export (SOC 2 / HIPAA / EU AI Act)

## Non-goals for now
- Full external marketplace
- On-chain reputation
- Production-grade billing UI
- Autonomous deployments

## Pricing strategy
- Free: OSS proxy (MIT)
- Team ($299/mo): governance + budget + PII
- Business ($999/mo): compliance + SSO + SLA

## Success criteria
- An operator can find an agent and its cost in under 30 seconds
- A high-risk action is blocked without approval
- The system stores enough evidence to explain a risky action after the fact
- A reviewer can understand the main flow from UI and API
