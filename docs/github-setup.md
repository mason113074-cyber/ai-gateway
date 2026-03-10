# GitHub Setup for Cursor

## Goal
Let Cursor Background Agents work on isolated branches and open pull requests.

## Steps
1. Create an empty GitHub repository.
2. Install the official Cursor GitHub app.
3. Grant access only to this repository or a small set of repos.
4. Push this bootstrap repo.
5. Open issues based on `docs/issues/*.md`.
6. In each issue, comment `@cursor <your prompt>` to trigger a Background Agent.

## Why this is safer
- one issue per branch
- full diff review
- PR-based approval before merge
- easier rollback when Cursor gets creative in the wrong direction
