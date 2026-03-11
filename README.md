# AI Gateway

AI gateway and agent governance control plane. Agent Access + Audit Layer: know which agent is acting; know what tools and data it may access; require approvals for risky actions; keep replayable audit evidence.

## Project memory (source of truth)

Long-term context lives in the repo, not in chat:

- **AGENTS.md** — mission, boundaries, workflow, definition of done
- **docs/context/** — current status, decisions, roadmap, handoff, domain glossary

Start with AGENTS.md and `docs/context/current-status.md` before coding.

## Cursor in this repo

- **Rules**: `.cursor/rules/` — core, architecture, security, web, api, domain, testing, git workflow, docs/memory
- **Commands** (skills): `.cursor/commands/` — plan-issue, implement-*-slice, subagent-*, run-all-and-fix, security-pass, create-pr-summary, update-memory, handoff
- **Memory context**: `docs/context/*` — do not rely on hidden chat memory
- **Bugbot**: `.cursor/BUGBOT.md` — review policy for PRs
- **Background agents must never**: push to main, change deployment/prod configs, add secrets, merge unrelated histories, force-push to shared branches, rename internal package names without a safe plan

## Quick start

1. Node 20+ and pnpm (e.g. Corepack: `corepack enable`).
2. `pnpm install`
3. `pnpm dev` — web :3000, API :4000
4. `pnpm build` && `pnpm test` to validate

## Repo structure

- **apps/web** — Next.js admin dashboard
- **apps/api** — Fastify control-plane API
- **packages/domain** — shared types, policy engine, mock data
- **docs/** — prd, architecture, backlog, context (memory), workflow, prompts
