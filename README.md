# Agent Control Tower

A bootstrap repository for an **Agent Access + Audit Layer** product.

This repo is intentionally optimized for **Cursor-first development**:

- project-level Cursor rules in `.cursor/rules`
- plain-language guardrails in `AGENTS.md`
- background agent machine template in `.cursor/environment.json`
- implementation prompts in `docs/prompts`
- a small but useful code scaffold for web, API, and shared domain logic

## What this product is

Think of this as the control tower for AI agents inside a company:

- every agent has an identity and owner
- every action is checked by policy
- risky actions require approval
- every important event leaves an audit trail

## Repo structure

```text
apps/
  api/        Fastify control-plane API
  web/        Next.js admin dashboard
packages/
  domain/     shared types, policy engine, mock data
.cursor/
  rules/      Cursor project rules
  environment.json
.github/
  workflows/  CI scaffold
  ISSUE_TEMPLATE/
docs/
  architecture.md
  prd.md
  backlog.md
  cursor-ultra-research.md
  prompts/
```

## Quick start

1. Install Node 20+ and pnpm via Corepack.
2. Run `corepack enable`.
3. Run `pnpm install`.
4. Run `pnpm dev`.
5. Open the repo in Cursor.
6. Read `AGENTS.md` first.
7. Use the prompts in `docs/prompts/` to let Cursor continue the build.

## Before using Cursor Background Agents

1. Connect the official Cursor GitHub app.
2. Create or choose a GitHub repo.
3. Enable Privacy Mode if your code is sensitive.
4. Review `.cursor/environment.json` and add secrets in Cursor, not in code.
5. Start with the issue plan in `docs/backlog.md`.

## GitHub push

This repo includes `scripts/push-to-github.sh`.

Example:

```bash
./scripts/push-to-github.sh git@github.com:YOUR_ORG/agent-control-tower.git
```

You still need valid GitHub credentials locally.

## Suggested first Cursor workflow

1. Open repo in Cursor.
2. Ask mode: read `docs/prd.md`, `docs/architecture.md`, `docs/backlog.md`, and `AGENTS.md`.
3. Agent mode: execute `docs/prompts/00-bootstrap.md`.
4. Create GitHub issues from `docs/issues/*.md`.
5. Trigger Background Agents from issues with `@cursor <prompt>`.

## Current status

This is a **bootstrap scaffold**, not a finished production system.
The point is to make Cursor successful from day one instead of making it improvise the whole company from thin air.
