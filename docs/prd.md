# Product Requirements Document

## Product name
AI Gateway

## Problem
Companies increasingly use AI agents to read data, call tools, draft emails, and change records.
The blocker is not only intelligence. The blocker is trust:
- who is this agent?
- what can it access?
- what did it do?
- who approved risky actions?
- how do we investigate incidents?

## Target user
- internal AI platform teams
- engineering platform / DevOps / ITOps teams
- security and governance teams
- operations teams deploying internal AI agents

## Core jobs to be done
1. Register and catalog agents.
2. Define what tools and data scopes each agent may use.
3. Evaluate policy before risky actions.
4. Route risky actions to approval.
5. Preserve audit evidence and trace replay.

## MVP scope
- workspace and agent registry
- policy evaluation endpoint
- approval request / approve / reject flow
- audit event writing and listing
- simple dashboard pages for overview, agents, approvals, and audit

## Non-goals for MVP
- full external marketplace
- on-chain reputation
- production-grade billing
- autonomous deployments

## Success criteria
- an operator can find an agent and its owner in under 30 seconds
- a high-risk action is blocked without approval
- the system stores enough evidence to explain a risky action after the fact
- a reviewer can understand the main flow from UI and API skeletons
