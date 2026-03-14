# Current status

- **Branch health**: This repo is the canonical root. Branch `main` is protected. Feature branch `feat/proxy-layer` has Phase 1 (LLM proxy layer) implemented per CURSOR_MASTER_ORDER.md.
- **Architecture snapshot**: Monorepo with apps/web (Next.js), apps/api (Fastify), packages/domain (types + policy + proxy-types + log-store). See docs/architecture.md.
- **Done**: T001; auth-middleware test cleanup; CI fix; Phase 1 proxy layer; Phase 2 agent registry: AgentRegistry + InMemoryAgentRegistry, ensureExists in proxy, GET/POST/PATCH /api/agents, agents list + edit pages, domain and API tests.
- **In progress**: Phase 2 PR (feat/t002-agent-registry) ready to push.
- **Blockers**: None.
- **Next 3 priorities**: (1) Merge Phase 2 PR. (2) Phase 3 policy verdict + proxy integration (T003, closes #4). (3) Phase 4 cost dashboard + README.
