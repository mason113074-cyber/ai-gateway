# Backlog

## T001 Workspace and auth scaffold
- add tenant/workspace concept
- add auth middleware placeholder
- prepare RBAC shape

## T002 Agent registry CRUD skeleton
- create list/create/update endpoints
- add persistent storage interface
- render create/edit forms

## T003 Policy engine endpoint
- expand policy evaluation logic
- add deny / allow / requires_approval decisions
- store rationale

## T004 Approval workflow
- create approval request endpoint
- add approve / reject actions
- show pending queue in UI

## T005 Audit writer and reader
- create audit event store abstraction
- write events for state changes
- render filtered event list

## T006 Trace viewer skeleton
- model trace spans and steps
- show step timeline in UI

## T007 MCP connector scaffold
- create connector abstraction
- wire read-only example connector first

## T008 Admin dashboard hardening
- loading states
- error boundaries
- basic role checks
