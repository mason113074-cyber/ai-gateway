# CURSOR — What to do next (maintained)

> This file used to contain a long **historical** “Phases 5–10” implementation runbook. Those phases are **already implemented on `main`**. Do not re-execute old step-by-step build instructions unless you are intentionally porting to a new codebase.

## Source of truth
- **Shipped scope and architecture**: `docs/context/current-status.md` and `docs/architecture.md`
- **Agent onboarding**: `AGENTS.md`

## Product priorities (research-backed, not a task checklist)
| Priority | Theme | Notes |
|----------|--------|--------|
| P0 | Adapter layer for multi-provider | Prerequisite before any cross-provider fallback |
| P0 | PostgreSQL runtime parity | Optional enterprise path; SQLite remains default OSS |
| P1 | SSO / SAML | Common enterprise gate |
| P1 | Web E2E tests | Admin flows currently manual |
| P2 | Helm / K8s packaging | After compose is stable |

## Historical context
The detailed Phase 5–10 prompts (SQLite migration, RBAC, Docker, etc.) remain in git history for reference only. If you need the old narrative, use `git log --follow -- docs/CURSOR_NEXT_ORDER.md`.

## Competitive snapshot (illustrative)
Enterprise buyers often require SOC 2 and SSO; gateway + compliance + guardrails remains a crowded but differentiated space when agent identity (`x-agent-id`) and policy are first-class.
