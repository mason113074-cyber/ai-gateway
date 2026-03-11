# Command: implement-web-slice

Work only in allowed web paths:

- **Allowed**: apps/web/**
- **Forbidden**: apps/api/**, packages/domain/** unless import surface requires tiny, agreed changes

Preserve routing, metadata, loading/error states, and accessibility. Add tests if behavior is testable. Include risk and rollback notes in the PR.
