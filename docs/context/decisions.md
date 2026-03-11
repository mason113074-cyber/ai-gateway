# Decisions (ADR-lite)

| Date       | Decision | Reason | Trade-off | Follow-up |
|------------|----------|--------|-----------|-----------|
| (setup)    | Cursor OS at repo root; monorepo under agent-control-tower/ | Single repo for ai-gateway; codebase stays in subfolder until/unless repo is replaced | Root has two “roots” (root vs agent-control-tower); globs use **/apps/** to match either | Consider unifying to one root if repo is recreated from agent-control-tower |
| (setup)    | Repo memory in docs/context/*.md | Hidden chat memory unreliable; versioned, visible source of truth | Must be updated manually or via update-memory command | Use update-memory command after meaningful changes |
| (setup)    | Subagents as role lanes (architect, api, web, qa-security, docs-release) | No first-class subagent UI; role boundaries reduce cross-cutting mistakes | Requires discipline to stay in lane | Enforce via rules and commands |
