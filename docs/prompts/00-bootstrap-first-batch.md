# First batch of issues (T001–T003)

After push, use this plan to create GitHub issues and PRs. Per `00-bootstrap.md`: minimum changes only, no deployment/production config, small reviewable commits, tests for new domain logic.

---

## Implementation plan (T001–T003 only)

### T001 Workspace and auth scaffold
- **Scope**: Add tenant/workspace concept, auth middleware placeholder, prepare RBAC shape.
- **API**: New route group or prefix for workspace context; middleware that reads a placeholder header (e.g. `x-workspace-id`) and attaches to request; no real auth yet.
- **Domain**: Types for `Workspace`, `Role` (e.g. admin, viewer); optional pure function `getEffectiveRole(workspace, user)` for tests.
- **Web**: No UI change required for T001; optional env or config to pass workspace for later.
- **Tests**: Unit tests in `packages/domain` for role/workspace helpers.
- **Risks**: Placeholder auth must not be used for any real authorization; document that it is for scaffold only.
- **Rollback**: Remove middleware and workspace types; single PR.

### T002 Agent registry CRUD skeleton
- **Scope**: List/create/update agents; persistent storage interface; simple create/edit forms in admin UI.
- **API**: `GET /agents`, `POST /agents`, `PATCH /agents/:id` (or `PUT`); validate body with shared types from domain; storage via an interface (in-memory or minimal file/store impl for dev).
- **Domain**: Already has agent types; add `AgentRegistry` interface (list, create, update, getById); one in-memory implementation for tests and dev.
- **Web**: Pages for list agents, create agent form, edit agent form; call API from server components or simple client fetch.
- **Tests**: Domain tests for registry interface (in-memory); API tests optional for this batch.
- **Risks**: No persistence yet; document that storage is replaceable.
- **Rollback**: Remove routes and UI; revert domain interface if unused elsewhere.

### T003 Policy evaluation endpoint
- **Scope**: Expand policy to allow/deny/requires_approval with rationale; expose evaluation via HTTP.
- **API**: `POST /policy/evaluate` body: agent id, action, context; response: decision, rationale.
- **Domain**: Extend `evaluatePolicy` (or equivalent) to return `{ decision: 'allow'|'deny'|'requires_approval', rationale: string }`; add tests for all three outcomes.
- **Web**: Optional minimal “policy check” form or reuse in approvals flow later.
- **Tests**: Domain tests for policy outcomes; API test for endpoint shape.
- **Risks**: Policy logic must remain in domain; API only orchestrates and returns result.
- **Rollback**: Remove endpoint; keep domain policy changes if used elsewhere.

---

## Suggested GitHub issues (first batch)

Create these three issues (and optionally a meta “Bootstrap T001–T003” epic):

1. **T001 – Workspace and auth scaffold**  
   Description: Implement workspace/tenant concept, auth middleware placeholder, and RBAC shape. No production auth.  
   Acceptance: Workspace type and middleware in API; domain types and tests; PR with risks and rollback notes.

2. **T002 – Agent registry CRUD skeleton**  
   Description: Registry CRUD endpoints and UI skeletons for list/create/edit agents; storage interface + in-memory impl.  
   Acceptance: GET/POST/PATCH agents; domain registry interface and tests; admin forms; PR with risks and rollback notes.

3. **T003 – Policy evaluation endpoint**  
   Description: Expand policy to allow/deny/requires_approval with rationale; add POST /policy/evaluate.  
   Acceptance: Domain policy returns decision + rationale; API endpoint; tests; PR with risks and rollback notes.

---

## Order of work

1. T001 first (workspace/auth shape used by T002/T003).
2. T002 second (registry needed for policy to resolve agents).
3. T003 third (policy endpoint consumes registry + policy engine).

One branch per issue, one PR per branch; keep PRs small and reviewable.
