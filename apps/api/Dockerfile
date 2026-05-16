# ── Santa Isabel — API (NestJS) ────────────────────────────────
# Build context: monorepo root
#   docker build -f apps/api/Dockerfile -t santaisabel-api .

# ── Stage 1: base ──────────────────────────────────────────────
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.12.3 --activate

# ── Stage 2: install deps ──────────────────────────────────────
FROM base AS deps
WORKDIR /app

# Copy workspace manifests (all package.json needed for pnpm workspaces)
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml turbo.json ./
COPY packages/config/package.json      ./packages/config/package.json
COPY packages/shared/package.json      ./packages/shared/package.json
COPY packages/db/package.json          ./packages/db/package.json
COPY packages/report-templates/package.json ./packages/report-templates/package.json
COPY apps/api/package.json             ./apps/api/package.json
COPY apps/web/package.json             ./apps/web/package.json

RUN pnpm install --frozen-lockfile

# ── Stage 3: build ────────────────────────────────────────────
FROM deps AS builder
WORKDIR /app

COPY packages/ ./packages/
COPY apps/api/ ./apps/api/

# 1. Build shared types/schemas
RUN pnpm --filter @santaisabel/shared build
# 2. Generate Prisma client (no DB needed, just schema)
RUN pnpm --filter @santaisabel/db generate
# 3. Build NestJS API
RUN pnpm --filter @santaisabel/api build

# ── Stage 4: production image ─────────────────────────────────
FROM node:22-alpine AS runner
RUN corepack enable && corepack prepare pnpm@9.12.3 --activate
WORKDIR /app

ENV NODE_ENV=production
ENV TZ=America/Bogota

# Copy only what's needed to run
COPY --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder /app/package.json         ./package.json
COPY --from=builder /app/node_modules         ./node_modules

# Shared package (built)
COPY --from=builder /app/packages/shared/dist         ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /app/packages/shared/node_modules ./packages/shared/node_modules

# Prisma client + schema + migrations
COPY --from=builder /app/packages/db/package.json          ./packages/db/package.json
COPY --from=builder /app/packages/db/node_modules          ./packages/db/node_modules
COPY --from=builder /app/packages/db/prisma                ./packages/db/prisma
COPY --from=builder /app/packages/db/src                   ./packages/db/src

# API compiled output
COPY --from=builder /app/apps/api/dist         ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules

# Startup script
COPY apps/api/start.sh ./start.sh
RUN chmod +x ./start.sh

EXPOSE 4000
CMD ["./start.sh"]
