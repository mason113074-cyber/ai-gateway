# Current status

- **Branch health**: This repo is the canonical root. Branch `main` is protected. Feature branch `feat/proxy-layer` has Phase 1 (LLM proxy layer) implemented per CURSOR_MASTER_ORDER.md.
- **Architecture snapshot**: Monorepo with apps/web (Next.js), apps/api (Fastify), packages/domain (types + policy + proxy-types + log-store + agent-registry). See docs/architecture.md.
- **Done**: T001; auth-middleware test cleanup; CI fix; Phase 1–4 complete: proxy layer, agent registry, policy verdict + proxy integration, cost dashboard + logs + landing page + OSS README.
- **In progress**: PR #13 to merge feat/cost-dashboard into main (bring Phase 2–4 into main).
- **Blockers**: None.
- **Next 3 priorities**: (1) Merge PR #13. (2) Optional: T-PROXY-* and T-OSS-* follow-up issues from CURSOR_MASTER_ORDER.
