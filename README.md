# AI Gateway

Open-source LLM proxy with agent identity, cost tracking, and governance.

## Quick start

1. **Change your OpenAI base URL:**

   ```
   # Before
   https://api.openai.com/v1

   # After
   http://localhost:4000/v1
   ```

2. **Add agent identity headers:**

   ```
   x-agent-id: my-support-bot
   x-team-id: cx-team
   ```

3. Every LLM call is now automatically:
   - Logged with agent identity
   - Tracked for cost and token usage
   - Evaluated against your governance policies

## Features

- **One-line integration** — just change your base URL
- **Agent identity tagging** — every request tagged to a specific agent and team
- **Cost tracking** — real-time per-agent, per-team, per-model cost breakdown
- **Policy engine** — allow / deny / requires_approval decisions
- **Admin console** — Next.js dashboard for visibility

## Architecture

- **apps/api** — Fastify proxy + control API (port 4000)
- **apps/web** — Next.js admin console (port 3000)
- **packages/domain** — policy engine + shared types

## Development

```bash
pnpm install
pnpm turbo dev
```

Run checks and tests:

```bash
pnpm turbo check
pnpm turbo test
pnpm turbo build
```

## Project memory (source of truth)

- **AGENTS.md** — mission, boundaries, workflow, definition of done
- **docs/context/** — current status, decisions, roadmap, handoff

Start with AGENTS.md and `docs/context/current-status.md` before coding.

## License

MIT — see LICENSE.
