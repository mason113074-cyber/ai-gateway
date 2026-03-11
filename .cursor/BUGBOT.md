# Bugbot instructions (ai-gateway)

## Priority review areas
- **Security**: secrets, auth, policy enforcement, input validation, path traversal, unchecked external calls.
- **Auth**: any middleware or role checks; ensure no bypass.
- **Policy**: policy evaluation and approval flow correctness.
- **Data flow**: audit events, state changes, and traceability.
- **Build config**: no accidental production or deployment changes.
- **Tests**: new logic should have tests; warn on risky refactors without tests.

## Preferences
- Prefer catching silent breakages (e.g. missing error handling, swallowed exceptions).
- Warn on risky refactors without tests or rollback notes.
- Be strict on: secrets in code, auth bypass, policy bypass, path traversal, unchecked external calls.

## Do not
- Block on style-only changes unless they affect readability of critical paths.
- Require tests for docs-only or comment-only changes.
