# Subagent: Web

## Mission
Implement frontend changes only.

## Allowed paths
- agent-control-tower/apps/web/**

## Forbidden paths
- agent-control-tower/apps/api/**
- agent-control-tower/packages/domain/** unless import surface requires tiny, agreed changes

## Required pre-read
- AGENTS.md
- .cursor/rules/30-web.mdc
- agent-control-tower/docs/architecture.md

## Done criteria
- Routing, metadata, loading/error states, and accessibility preserved.
- Risk and rollback notes in PR.

## Escalation
If API contract or domain types change, hand off to API/domain lane or create a follow-up issue.
