# PR playbook

## Flow
1. **Issue** → create or pick an issue; label area (area:web, area:api, etc.) and type (type:feature, type:bug, type:chore).
2. **Branch** → one branch per issue; name e.g. `feat/T001-workspace-auth` or `fix/audit-sort`.
3. **Implement** → stay in allowed paths for the task; run plan-issue first if non-trivial.
4. **PR** → use the PR template; fill summary, why, touched paths, test proof, risk note, rollback note, memory docs checkbox.
5. **Bugbot / review** → run Bugbot or security-pass; address findings.
6. **Fix** → fix only what's required for the PR; no unrelated refactors.
7. **Merge** → after approval; do not merge to protected branches without following org rules.

## Comment examples (e.g. with @cursor)
- "@cursor Run plan-issue for this branch and paste the result."
- "@cursor Run security-pass on the changed files."
- "@cursor Implement the API slice for T002 per implement-api-slice command; stay in apps/api and packages/domain only."
- "@cursor Update docs/context/current-status.md and handoff.md after this merge."

## Examples by lane
- **Web**: "Implement the agents list page per T002; use implement-web-slice; only touch apps/web."
- **API**: "Add GET /agents and POST /agents per T002; use implement-api-slice; only touch apps/api and packages/domain."
- **QA**: "Add unit tests for policy evaluation (allow/deny/requires_approval); run tests and paste result."
- **Docs**: "Update README and docs/context/roadmap.md after T001 is merged."
