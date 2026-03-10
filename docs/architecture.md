# Architecture

## High-level view

```text
Users / Operators
      ↓
Next.js Admin Console
      ↓
Fastify Control API
      ↓
Policy Engine + Registry + Approval Service + Audit Writer
      ↓
Future integrations: DB, IAM, MCP connectors, external tools
```

## Layers

### Web
Admin console for:
- agent registry
- pending approvals
- audit event review
- future trace replay

### API
HTTP boundary for:
- health
- registry endpoints
- approvals endpoints
- audit endpoints
- policy evaluation

### Domain
Shared logic and types:
- policy decision logic
- agent and audit types
- mock data for early UI/API development

## Future extensions
- Postgres persistence
- Redis job queue
- SSO / RBAC
- MCP connector gateway
- trace storage and replay UI
- webhook / event bus

## Principles
- keep domain logic testable
- make state-changing events auditable
- separate product rules from framework glue
- avoid premature complexity
