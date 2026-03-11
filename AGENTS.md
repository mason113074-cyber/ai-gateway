# Project Instructions (ai-gateway)

## Mission
Build an enterprise-grade **Agent Access + Audit Layer** (control plane for company AI agents).

**Product one-liner:** Know which agent is acting; know what tools and data it may access; require approvals for risky actions; keep replayable audit evidence.

## Repo layout
- **Monorepo** lives under `agent-control-tower/`: pnpm workspaces, TypeScript throughout.
- **apps/web**: Next.js admin console.
- **apps/api**: Fastify control API.
- **packages/domain**: Shared types and policy logic.
- **docs/**: PRD, architecture, backlog, context (repo memory), workflow, prompts.

## Required reading order before coding
1. This file (AGENTS.md).
2. `agent-control-tower/docs/prd.md`
3. `agent-control-tower/docs/architecture.md`
4. `agent-control-tower/docs/backlog.md`
5. Relevant `.cursor/rules/*` for the paths you are editing.
6. `docs/context/current-status.md` and `docs/context/decisions.md` when making non-trivial changes.

## Hard boundaries (never do)
- Never add secrets to source control.
- Never change deployment or production configs unless explicitly asked.
- Never weaken auth, policy enforcement, or audit requirements for convenience.
- Never merge directly to a protected branch (e.g. main) unless explicitly told.
- Never change more than one major subsystem in the same PR unless the task explicitly requires it.
- Never assume architecture or repo state—inspect first.
- Never rewrite history or merge unrelated histories.
- Never rename internal workspace/package names without proving it is safe (build, imports, package.json).

## Architecture guardrails
- Keep UI, API, domain, and infra concerns separated.
- No shortcut imports across forbidden boundaries (see `.cursor/rules/10-architecture.mdc`).
- Domain logic stays testable and framework-agnostic where possible.
- State-changing events must be auditable.

## Security guardrails
- Do not expose secrets; no insecure defaults; least privilege.
- Validate all external inputs; log security-relevant actions.
- Every risky operation must have a path to approval.
- Never bypass policy checks in API handlers.

## Test policy
- Every logic change needs tests or a written reason.
- Prefer unit tests for domain logic; add integration/e2e when they protect behavior.
- Never claim tests passed unless actually run.

## Git / PR workflow
- One issue → one branch → one PR.
- Small, reviewable commits; clear commit messages.
- PR must include: summary, why this change, touched paths, test proof, risk note, rollback note.
- Include memory-docs-updated checkbox when behavior or decisions change.

## Definition of done
A task is not done unless:
- Code compiles.
- Relevant tests are added or updated.
- Risky assumptions are documented.
- README or docs updated if behavior changed.
- Rollback notes included in the PR for non-trivial changes.

## Rollback expectation
- Every non-trivial change must have a short rollback note in the PR (how to revert, what to watch).

## Priority order
1. Safety and access control.
2. Correctness and traceability.
3. Developer ergonomics.
4. UI polish.

## Good first slices (backlog)
- T001 workspace and auth scaffold
- T002 agent registry CRUD skeleton
- T003 policy evaluation endpoint
- T004 approval workflow skeleton
- T005 audit event writer and reader
- T006 trace viewer UI skeleton
