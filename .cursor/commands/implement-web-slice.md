# Command: implement-web-slice

Work only in allowed web paths:

- **Allowed**: agent-control-tower/apps/web/**
- **Forbidden**: agent-control-tower/apps/api/**, agent-control-tower/packages/domain/** unless import surface requires tiny, agreed changes

Preserve routing, metadata, loading/error states, and accessibility. Add tests if behavior is testable. Include risk and rollback notes in the PR.
