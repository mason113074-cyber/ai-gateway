# Stage 1: base
FROM node:20-slim AS base
RUN corepack enable && corepack prepare pnpm@10.5.2 --activate

# Stage 2: builder (full monorepo, build api + domain)
FROM base AS builder
WORKDIR /app

RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY packages/domain/package.json ./packages/domain/
COPY apps/api/package.json ./apps/api/

RUN pnpm install --frozen-lockfile

COPY packages/domain ./packages/domain
COPY apps/api ./apps/api

RUN pnpm turbo build --filter=@agent-control-tower/api

# Stage 3: runner (minimal runtime)
FROM base AS runner
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=4000

COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/domain/dist ./packages/domain/dist
COPY --from=builder /app/packages/domain/package.json ./packages/domain/

EXPOSE 4000
VOLUME ["/app/data"]
CMD ["node", "dist/server.js"]
