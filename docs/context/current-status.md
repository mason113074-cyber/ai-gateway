# Current status

- **Branch health**: This repo is the canonical root. Branch `chore/unify-repo-and-cursor-os` (unification); `main` will be replaced by this history.
- **Architecture snapshot**: Monorepo with apps/web (Next.js), apps/api (Fastify), packages/domain (types + policy). See docs/architecture.md.
- **Done**: Cursor operating system imported; AGENTS.md, .cursor/rules, commands, BUGBOT, docs/context, subagent lanes, GitHub templates, environment, workflow docs. Build and test pass.
- **In progress**: Unification commit; push to GitHub; close shell PR #1; create T001–T003 issues.
- **Blockers**: None.
- **Next 3 priorities**: (1) Push this repo to origin main (replace shell). (2) Close PR #1. (3) Open T001–T003 issues and start implementation per docs/prompts/00-bootstrap-first-batch.md.
