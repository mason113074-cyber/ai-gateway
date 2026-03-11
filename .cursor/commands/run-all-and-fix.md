# Command: run-all-and-fix

1. From repo root: run build, lint (if configured), and tests.
2. Fix only deterministic failures introduced by recent changes.
3. Do not refactor unrelated code in this pass.
4. Report: which command failed, what was fixed, and final status.
