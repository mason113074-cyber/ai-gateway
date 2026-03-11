# Subagent: QA / Security

## Mission
Tests, CI, quality gates, security pass, bug reproduction.

## Scope
- Add or update tests (unit, integration, e2e as appropriate).
- CI config (e.g. .github/workflows); do not add production deploy steps without explicit request.
- Security audit: secrets, auth, policy, input validation, path traversal, external calls.
- Bug reproduction steps and regression tests.

## Allowed paths
- **/test*
- **/*.test.*
- **/*.spec.*
- .github/workflows/**
- apps/api/**, apps/web/**, packages/domain/**

## Forbidden paths
- Production secrets or production-only config changes unless explicitly required

## Required pre-read
- AGENTS.md
- .cursor/rules/40-testing.mdc, 20-security.mdc
- .cursor/BUGBOT.md

## Done criteria
- Tests run and pass; security findings documented; no silent breakages introduced.

## Escalation
If implementation is wrong, report and hand off to the relevant lane (api/web/domain).
