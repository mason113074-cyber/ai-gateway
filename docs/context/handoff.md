# Handoff

- **Latest working state**: This repo is the canonical root. Branch `main` is protected. Feature branch `feat/t001-workspace-auth-scaffold` has T001 (workspace/role types, auth middleware placeholder, GET /api/session). PR #6 includes the CI fix (pnpm 10.5.2, Build before Check); merge #6 to land both. PR #5 can be closed if still open.
- **Commands to run**: `pnpm install`, `pnpm build`, `pnpm test`, `pnpm dev` (web :3000, API :4000).
- **Files to inspect next**: AGENTS.md, docs/context/current-status.md, .cursor/rules/*, docs/backlog.md, docs/context/t001-implementation-plan.md.
- **Unresolved risks**: None.
