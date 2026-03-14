# Current status

- **Branch health**: This repo is the canonical root. Branch `main` is protected. Feature branch `feat/proxy-layer` has Phase 1 (LLM proxy layer) implemented per CURSOR_MASTER_ORDER.md.
- **Architecture snapshot**: Monorepo with apps/web (Next.js), apps/api (Fastify), packages/domain (types + policy + proxy-types + log-store). See docs/architecture.md.
- **Done**: T001; auth-middleware test cleanup; CI fix; Phase 1 proxy; Phase 2 agent registry; Phase 3 policy: PolicyVerdict, rationale, deny rule (external delete), policy check in proxy (deny → 403), extended policy tests.
- **In progress**: Phase 3 PR (feat/t003-policy-evaluation) ready to push.
- **Blockers**: None.
- **Next 3 priorities**: (1) Merge Phase 3 PR. (2) Phase 4 cost dashboard + README. (3) Merge all phase PRs.
