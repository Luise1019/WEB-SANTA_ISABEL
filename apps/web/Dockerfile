# ── Santa Isabel — Web (Next.js 14) ───────────────────────────
# Build context: monorepo root
#   docker build -f apps/web/Dockerfile -t santaisabel-web .

# ── Stage 1: base ──────────────────────────────────────────────
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.12.3 --activate

# ── Stage 2: install deps ──────────────────────────────────────
FROM base AS deps
WORKDIR /app

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
COPY apps/web/  ./apps/web/

# Build shared package first
RUN pnpm --filter @santaisabel/shared build

# NEXT_PUBLIC_API_URL: "/" means Next.js rewrites /api/v1/* internally via next.config.mjs
# Railway will set the correct value via env vars in the dashboard
ARG NEXT_PUBLIC_API_URL=/api/v1
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_TELEMETRY_DISABLED=1

RUN pnpm --filter @santaisabel/web build

# ── Stage 4: production image ─────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV TZ=America/Bogota
ENV NEXT_TELEMETRY_DISABLED=1

# Next.js standalone output (if enabled) or full build
COPY --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder /app/package.json         ./package.json
COPY --from=builder /app/node_modules         ./node_modules

COPY --from=builder /app/packages/shared/dist         ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /app/packages/shared/node_modules ./packages/shared/node_modules

COPY --from=builder /app/apps/web/.next        ./apps/web/.next
COPY --from=builder /app/apps/web/public       ./apps/web/public
COPY --from=builder /app/apps/web/package.json ./apps/web/package.json
COPY --from=builder /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=builder /app/apps/web/next.config.mjs ./apps/web/next.config.mjs

RUN corepack enable && corepack prepare pnpm@9.12.3 --activate

EXPOSE 3000
CMD ["pnpm", "--filter", "@santaisabel/web", "start"]
