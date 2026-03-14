# T001 Implementation Plan — Workspace and auth scaffold

## Goal
Add workspace/tenant concept and auth scaffold only: domain types, request context shape, middleware placeholder, one minimal protected route. No real auth provider, no DB persistence.

## Touched paths
- **packages/domain**: `Workspace` type, `Role` type (e.g. admin, viewer), optional `getEffectiveRole(workspace, user)`; export from index.
- **apps/api**: Request context type with `workspaceId`, `userId`; auth middleware placeholder that attaches stub principal/workspace; one minimal route (e.g. `GET /api/session` or probe) that reads from context.

## Test plan
- Domain: unit tests for workspace invariants and `getEffectiveRole` (if added).
- API: unit or integration tests for middleware attaching context and for the probe route returning context-derived data.

## Risk note
Placeholder auth must not be used for any real authorization. Document in code and PR that it is scaffold only; no production auth.

## Rollback note
Revert single PR: remove middleware registration and route; remove workspace/role types from domain; no DB or external systems to restore.

## Allowed / Forbidden (role lanes)
- **Allowed**: apps/api/**, packages/domain/**
- **Forbidden**: apps/web/** (no UI change for T001), package renames, database layer, real auth vendor.
