# Contributing to AI Gateway

Thank you for considering contributing. This project follows a simple fork → branch → PR workflow.

## Workflow

1. **Fork** the repository on GitHub.
2. **Create a branch** from `main` for your change (e.g. `feat/my-feature` or `fix/issue-123`).
3. **Make your changes** and ensure tests and checks pass.
4. **Open a Pull Request** against `main` with a clear title and description.

We use **one issue → one branch → one PR**. Prefer small, reviewable changes.

## Code style

- **Language:** TypeScript throughout the monorepo.
- **Linting:** Use the project’s existing tooling (ESLint / Biome if configured). Match existing style in the codebase.
- **Formatting:** Consistent indentation and line length; no trailing whitespace.

## Tests and checks

Before submitting a PR:

- `pnpm turbo check` — TypeScript and lint must pass.
- `pnpm turbo test` — All tests must pass.
- `pnpm turbo build` — Production build must succeed.

Do not claim tests passed without running them. For logic changes, add or update tests (see `docs/context` and `.cursor/rules` for policy).

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat: add X` — new feature
- `fix: resolve Y` — bug fix
- `docs: update Z` — documentation only
- `chore: ...` — tooling, deps, etc.

Start with a short summary line; add a body if the change needs explanation.

## PR requirements

Your PR should include:

- **Summary** — what changed and why
- **Touched paths** — list of key files
- **How you tested** — commands or scenarios
- **Risk/rollback** — any notable risk and how to revert if needed

Mention if you updated repo memory docs (`docs/context/current-status.md`, `decisions.md`, etc.).

## Issues

- Use GitHub Issues for bugs and feature requests.
- Check existing issues and discussions before opening a new one.
- Be clear and concise; include steps to reproduce for bugs.

## Questions

Open a GitHub Discussion or an issue with the `question` label.

Thank you for contributing.
