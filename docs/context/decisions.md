# Decisions (ADR-lite)

| Date       | Decision | Reason | Trade-off | Follow-up |
|------------|----------|--------|-----------|-----------|
| (setup)    | This repo is the single canonical root; Cursor OS lives with code | One repo, one root, one brain; no shell/code split | — | — |
| (setup)    | Repo memory in docs/context/*.md | Hidden chat memory unreliable; versioned, visible source of truth | Must be updated manually or via update-memory command | Use update-memory command after meaningful changes |
| (setup)    | Subagents as role lanes (architect, api, web, qa-security, docs-release) | Role boundaries reduce cross-cutting mistakes | Requires discipline to stay in lane | Enforce via rules and commands |
