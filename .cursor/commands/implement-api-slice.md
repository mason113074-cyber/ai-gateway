# Command: implement-api-slice

Work only in allowed API and domain paths:

- **Allowed**: apps/api/**, packages/domain/**
- **Forbidden**: apps/web/**, deployment/prod configs unless explicitly required

Preserve handler/service/domain split. Validate DTOs at the boundary. Add or update tests for domain logic. Include risk and rollback notes in the PR.
