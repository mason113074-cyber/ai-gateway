# Handoff

- **Latest working state**: Branch `chore/cursor-operating-system`; Cursor OS files at repo root; agent-control-tower/ holds the monorepo (separate git).
- **Commands to run**: From agent-control-tower: `pnpm install`, `pnpm build`, `pnpm test`, `pnpm dev` (web :3000, API :4000).
- **Files to inspect next**: AGENTS.md, docs/context/current-status.md, .cursor/rules/*, agent-control-tower/docs/backlog.md.
- **Unresolved risks**: Repo root vs agent-control-tower root (two trees); decide whether to push agent-control-tower as main content later.
