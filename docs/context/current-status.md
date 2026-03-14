# Current status

- **Branch health**: This repo is the canonical root. Branch `main` is protected. Feature branch `feat/proxy-layer` has Phase 1 (LLM proxy layer) implemented per CURSOR_MASTER_ORDER.md.
- **Architecture snapshot**: Monorepo with apps/web (Next.js), apps/api (Fastify), packages/domain (types + policy + proxy-types + log-store). See docs/architecture.md.
- **Done**: T001; auth-middleware test cleanup; CI fix; Phase 1–4 complete: proxy layer, agent registry, policy verdict + proxy integration, cost dashboard + logs + landing page + OSS README.
- **In progress**: Phase 4 PR (feat/cost-dashboard) ready to push.
- **Blockers**: None.
- **Next 3 priorities**: (1) Merge Phase 1–4 PRs in order. (2) Close issues #3, #4. (3) Optional: T-PROXY-* and T-OSS-* follow-up issues from CURSOR_MASTER_ORDER.
