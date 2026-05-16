#!/bin/sh
set -e

echo "🔄 Ejecutando migraciones de base de datos..."
cd /app/packages/db
npx prisma migrate deploy

echo "🚀 Iniciando API Santa Isabel..."
exec node /app/apps/api/dist/main.js
