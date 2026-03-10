# Cursor Setup Checklist

These settings are partly repo-managed and partly manual.

## Repo-managed settings already included
- `AGENTS.md`
- `.cursor/rules/*`
- `.cursor/environment.json`
- prompt pack in `docs/prompts`

## Manual settings you still need in Cursor
1. Connect the official Cursor GitHub app.
2. Choose the target repository scope.
3. Turn on Privacy Mode if this repo is sensitive.
4. Review the background agent spend limit.
5. Add any required secrets in Cursor's background agent settings, not in source control.
6. Optionally enable Custom Modes for Plan / Build / Review.
7. If using CLI, authenticate with browser login or a Cursor API key.

## Recommended operating model
- Use Ask mode for planning.
- Use Agent mode for local focused edits.
- Use Background Agents for isolated issue-based work.
- Use Bugbot on pull requests if you want extra review coverage.
