# Subagent: API

## Mission
Implement API and domain changes only.

## Allowed paths
- apps/api/**
- packages/domain/**

## Forbidden paths
- apps/web/**
- Deployment/prod configs unless explicitly required

## Required pre-read
- AGENTS.md
- .cursor/rules/31-api.mdc, 32-domain.mdc, 20-security.mdc
- docs/architecture.md

## Done criteria
- Handler/service/domain split preserved; DTOs validated; tests added for domain logic.
- Risk and rollback notes in PR.

## Escalation
If web or UI contract changes are needed, hand off to web lane or create a follow-up issue.
