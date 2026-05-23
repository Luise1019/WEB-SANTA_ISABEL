#!/usr/bin/env bash
set -euo pipefail

echo "==> Installing dependencies..."
pnpm install --frozen-lockfile

echo "==> Creating .env files..."

# API .env
cat > apps/api/.env << 'EOF'
NODE_ENV=development
TZ=America/Bogota
PORT=4000
WORKER=0
DATABASE_URL=postgresql://santaisabel:santaisabel@localhost:5432/santaisabel?schema=public
REDIS_URL=redis://localhost:6379
JWT_SECRET=dev-jwt-secret-please-change-32chars-aaaaaaaa
JWT_REFRESH_SECRET=dev-jwt-refresh-secret-32chars-bbbbbbbbb
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=30d
WEB_PUBLIC_URL=http://localhost:3000
EOF

# Web .env.local (Codespaces auto-forwards ports)
cat > apps/web/.env.local << 'EOF'
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
EOF

echo "==> Generating Prisma client..."
pnpm --filter @santaisabel/db run generate

echo "==> Running database migrations..."
pnpm --filter @santaisabel/db run migrate:deploy

echo "==> Seeding database..."
pnpm --filter @santaisabel/db run seed

echo "==> Building shared packages..."
pnpm --filter @santaisabel/shared run build
pnpm --filter @santaisabel/db run build

echo ""
echo "============================================"
echo "  Santa Isabel ready!"
echo "  Run: pnpm dev"
echo "  Web:  http://localhost:3000"
echo "  API:  http://localhost:4000"
echo "  Swagger: http://localhost:4000/docs"
echo "  Login: admin@santaisabel.local / admin123"
echo "============================================"
