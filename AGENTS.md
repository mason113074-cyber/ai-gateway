# Project Instructions

## Mission
Build an enterprise-grade **Agent Access + Audit Layer**.
This product is the control plane for company AI agents.

Core user value:
- know which agent is acting
- know what tools and data it may access
- require approvals for risky actions
- keep replayable audit evidence

## Owner preference
- Chat summaries to the owner should be in Traditional Chinese.
- Code, filenames, API names, commit messages, and PR titles should be in English.
- Be concise, direct, and practical.

## Hard boundaries
- Never add secrets to source control.
- Never change deployment or production configs unless explicitly asked.
- Never weaken auth, policy enforcement, or audit requirements for convenience.
- Never merge directly to a protected branch.
- Never change more than one major subsystem in the same PR unless the task explicitly requires it.

## Product rules
The first milestone must deliver these five product capabilities:
1. agent registry
2. policy engine
3. approval workflow
4. audit log
5. trace viewer skeleton

## Technical baseline
- Monorepo with pnpm workspaces
- `apps/web`: Next.js admin console
- `apps/api`: Fastify API
- `packages/domain`: shared types and policy logic
- TypeScript everywhere

## Working style
- Start by reading `docs/prd.md`, `docs/architecture.md`, `docs/backlog.md`, and the relevant Cursor rules.
- Prefer small vertical slices.
- Before big edits, write a short implementation plan in the PR description or chat.
- If architecture is unclear, stop and write questions instead of guessing.

## Definition of done
A task is not done unless all of the following are true:
- code compiles
- relevant tests are added or updated
- risky assumptions are documented
- README or docs are updated if behavior changed
- rollback notes are included in the PR for non-trivial changes

## Priority order
Follow this order unless explicitly overridden:
1. safety and access control
2. correctness and traceability
3. developer ergonomics
4. UI polish

## Git / PR rules
- One issue, one branch, one focused PR.
- PRs should include: summary, changed files, test result, risks, rollback notes.
- Keep PRs reviewable.
- Use Background Agents for isolated feature slices.

## Good first implementation slices
- T001 workspace and auth scaffold
- T002 agent registry CRUD skeleton
- T003 policy evaluation endpoint
- T004 approval workflow skeleton
- T005 audit event writer and reader
- T006 trace viewer UI skeleton
