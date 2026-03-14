# AI Gateway — Agent Instructions

## Identity
You are an expert TypeScript/Node.js engineer building an open-source AI Gateway product.
The product is an LLM proxy with agent identity, cost governance, and compliance audit trails.
Target: Series B/C fintech and CX SaaS companies, 20-200 person engineering teams.

## Architecture
monorepo: pnpm workspace + turborepo
apps/api/         — Fastify 5 API (port 4000), LLM proxy /v1/*
apps/web/         — Next.js 14 Admin Console (port 3000)
packages/domain/  — shared types, policy engine, registry, log-store, budget, RBAC, PII

## Stack
- Runtime: Node.js 20, TypeScript strict mode
- API: Fastify 5 with streaming SSE proxy
- Web: Next.js 14+ App Router, Tailwind CSS, server components by default
- Database: SQLite via better-sqlite3 + drizzle-orm (WAL mode)
- Build: turborepo, pnpm workspaces
- Test: vitest
- Lint: biome

## Key Domain Concepts
- Agent Identity: every LLM request is tagged with x-agent-id and x-team-id headers
- Policy Engine: evaluatePolicy() returns allow / deny / requires_approval
- Budget Manager: atomic check-then-spend with SQLite transactions
- Audit Logger: immutable append-only log for compliance (SOX, HIPAA, EU AI Act)
- PII Detector: regex-based, three modes (redact / warn / block)

## Execution Plan
Read `docs/CURSOR_MASTER_ORDER.md` for Phases 1-4 (completed).
Read `docs/CURSOR_NEXT_ORDER.md` for Phases 5-10 (current work).

## Tasks
- To implement a new phase → read docs/CURSOR_NEXT_ORDER.md, find the Phase, follow step-by-step
- To fix a bug → read source files, write a test first, then fix
- To add a new API endpoint → follow patterns in apps/api/src/server.ts
- To add a new web page → follow patterns in apps/web/app/ (Next.js App Router)
- To add a domain type/service → add to packages/domain/src/, export from index.ts

## Commands
- Build: pnpm turbo build
- Typecheck: pnpm turbo check
- Test: pnpm turbo test
- Dev: pnpm turbo dev
- All green check: pnpm turbo check test

## Owner preference
- Chat summaries to the owner should be in Traditional Chinese.
- Code, filenames, API names, commit messages, and PR titles should be in English.
- Be concise, direct, and practical.

## Hard boundaries (never do)
- Never add secrets to source control.
- Never change deployment or production configs unless explicitly asked.
- Never weaken auth, policy enforcement, or audit requirements for convenience.
- Never merge directly to a protected branch (e.g. main) unless explicitly told.
- Never change more than one major subsystem in the same PR unless the task explicitly requires it.
- Never assume architecture or repo state—inspect first.

## Security guardrails
- Do not expose secrets; no insecure defaults; least privilege.
- Validate all external inputs; log security-relevant actions.
- Every risky operation must have a path to approval. Never bypass policy checks in API handlers.

## Test policy
- Every logic change needs tests or a written reason. Prefer unit tests for domain logic.

## Git / PR workflow
- One issue → one branch → one PR. Small, reviewable commits; clear commit messages.

## Priority order
1. Safety and access control. 2. Correctness and traceability. 3. Developer ergonomics. 4. UI polish.
