# Current status

- **Branch health**: This repo is the canonical root. Branch `main` is protected (PR + 1 review + code owner + status check `ci` + conversation resolution). Feature branch `feat/t001-workspace-auth-scaffold` has T001 implementation.
- **Architecture snapshot**: Monorepo with apps/web (Next.js), apps/api (Fastify), packages/domain (types + policy). See docs/architecture.md.
- **Done**: Cursor OS; branch protection on main; CI fix (pnpm version + build-before-check); T001 workspace and auth scaffold (domain workspace/role types, request context, auth middleware placeholder, GET /api/session, tests).
- **In progress**: T001 PR to main (pending review).
- **Blockers**: None.
- **Next 3 priorities**: (1) Merge T001 PR. (2) T002 agent registry CRUD skeleton. (3) T003 policy evaluation endpoint per docs/prompts/00-bootstrap-first-batch.md.
