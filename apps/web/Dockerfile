# Stage 1: base
FROM node:20-slim AS base
ENV COREPACK_INTEGRITY_KEYS="0"
RUN corepack enable && corepack prepare pnpm@10.5.2 --activate

# Stage 2: builder
FROM base AS builder
WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.base.json ./
COPY packages/domain/package.json ./packages/domain/
COPY apps/web/package.json ./apps/web/

RUN pnpm install --frozen-lockfile

COPY packages/domain ./packages/domain
COPY apps/web ./apps/web

RUN pnpm turbo build --filter=@agent-control-tower/web

# Stage 3: runner (Next.js standalone)
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

EXPOSE 3000
CMD ["node", "apps/web/server.js"]
