# Project Instructions (AI Gateway)

## Mission
Build an enterprise-grade **Agent Access + Audit Layer** (control plane for company AI agents).

**Product one-liner:** AI gateway and agent governance control plane. Know which agent is acting; know what tools and data it may access; require approvals for risky actions; keep replayable audit evidence.

## Canonical repo
- **This repo** is the one true project root. Repo memory source of truth: `docs/context/*`. Commands act as project skills; role lanes act as subagents. One issue → one branch → one PR.

## Repo layout
- **Monorepo**: pnpm workspaces, TypeScript throughout. `apps/web` (Next.js), `apps/api` (Fastify), `packages/domain` (shared types and policy). `docs/`: PRD, architecture, backlog, context (repo memory), workflow, prompts.

## Owner preference
- Chat summaries to the owner should be in Traditional Chinese.
- Code, filenames, API names, commit messages, and PR titles should be in English.
- Be concise, direct, and practical.

## Required reading order before coding
1. This file (AGENTS.md).
2. `docs/prd.md`, `docs/architecture.md`, `docs/backlog.md`
3. Relevant `.cursor/rules/*` for the paths you are editing.
4. `docs/context/current-status.md` and `docs/context/decisions.md` when making non-trivial changes.

## Hard boundaries (never do)
- Never add secrets to source control.
- Never change deployment or production configs unless explicitly asked.
- Never weaken auth, policy enforcement, or audit requirements for convenience.
- Never merge directly to a protected branch (e.g. main) unless explicitly told.
- Never change more than one major subsystem in the same PR unless the task explicitly requires it.
- Never assume architecture or repo state—inspect first.
- Never rewrite history or merge unrelated histories.
- Never rename internal workspace/package names without proving it is safe (build, imports, package.json).

## Product rules
The first milestone must deliver: agent registry, policy engine, approval workflow, audit log, trace viewer skeleton.

## Architecture guardrails
- Keep UI, API, domain, and infra concerns separated. No shortcut imports across forbidden boundaries (see `.cursor/rules/10-architecture.mdc`). Domain logic stays testable; state-changing events must be auditable.

## Security guardrails
- Do not expose secrets; no insecure defaults; least privilege. Validate all external inputs; log security-relevant actions. Every risky operation must have a path to approval. Never bypass policy checks in API handlers.

## Test policy
- Every logic change needs tests or a written reason. Prefer unit tests for domain logic; never claim tests passed unless actually run.

## Git / PR workflow
- One issue → one branch → one PR. Small, reviewable commits; clear commit messages. PR must include: summary, why this change, touched paths, test proof, risk note, rollback note. Include memory-docs-updated checkbox when behavior or decisions change.

## Definition of done
- Code compiles. Relevant tests added or updated. Risky assumptions documented. README or docs updated if behavior changed. Rollback notes included in the PR for non-trivial changes.

## Rollback expectation
- Every non-trivial change must have a short rollback note in the PR (how to revert, what to watch).

## Priority order
1. Safety and access control. 2. Correctness and traceability. 3. Developer ergonomics. 4. UI polish.

## Good first slices (backlog)
- T001 workspace and auth scaffold
- T002 agent registry CRUD skeleton
- T003 policy evaluation endpoint
- T004 approval workflow skeleton
- T005 audit event writer and reader
- T006 trace viewer UI skeleton
