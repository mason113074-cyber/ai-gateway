# Cursor usage

## How to use `/plan-issue`
Run the **plan-issue** command (or open `.cursor/commands/plan-issue.md`) before implementing. It reads AGENTS.md and docs/context/current-status.md and produces scope, touched paths, test plan, risk, rollback, and PR checklist. Do not start implementation until the plan is confirmed.

## How to spin a role lane
Use the subagent commands to stay within boundaries:
- `/subagent-architect` — planning and review only
- `/subagent-api` — apps/api and packages/domain only
- `/subagent-web` — apps/web only
- `/subagent-qa-security` — tests, CI, security pass
- `/subagent-docs-release` — docs, PR summaries, issue cleanup

Each command instructs Cursor to stay within the role; read the matching file under `docs/cursor/subagents/` for full criteria.

## When to use foreground agent vs background agent
- **Foreground**: Small, local edits; plan-issue; handoff; docs. You see output immediately.
- **Background**: Isolated feature slices that need install/build/test on a clean environment. Background agents run on remote machines and can run terminal commands; use for well-scoped tasks (e.g. one issue, one slice).

## When to use Bugbot
Use Bugbot (or the **security-pass** and review steps) on PRs: diff review, security/auth/policy checks, test coverage, silent breakages. Configure repo-specific rules in `.cursor/BUGBOT.md`. Bugbot is a second pair of eyes, not a replacement for tests or risk notes.

## When to update repo memory
After meaningful changes: new decisions, status changes, roadmap updates. Run **update-memory** command or edit `docs/context/current-status.md`, `decisions.md`, `roadmap.md`, `handoff.md` as needed. Do not rely on hidden chat memory; docs/context is the source of truth.

## What never to let a background agent do
- Push directly to main (use a branch and PR).
- Change deployment or production configs unless explicitly requested.
- Add secrets to the repo.
- Merge unrelated histories or force-push to shared branches.
- Rename internal package/workspace names without a safe, verified plan.
