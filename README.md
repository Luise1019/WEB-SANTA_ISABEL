# santaisabel — Plataforma de Gestión de Proyectos Inmobiliarios

Aplicación web full-stack para gestionar proyectos inmobiliarios de vivienda en Colombia (VIS, VIP, NO VIS).

Reemplaza Excel para presupuesto, programación, flujo de caja, ventas, dashboard y órdenes de cambio. Genera reportes PDF con plantillas (prefactibilidad, ejecución presupuestal, actas comité, SECOP II).

## Stack

- **Backend:** NestJS 10 + Prisma 5 + Postgres 15 + Redis 7 + BullMQ
- **Frontend:** Next.js 14 (App Router) + TanStack Query + shadcn/ui + AG Grid + ECharts
- **Lenguaje:** TypeScript end-to-end (monorepo pnpm + turbo)
- **PDF:** Puppeteer + Handlebars en worker BullMQ
- **Storage:** Cloudflare R2
- **Despliegue:** Railway (single-tenant)

## Estructura

```
apps/
  api/          NestJS (API + worker BullMQ con flag WORKER=1)
  web/          Next.js 14 App Router
packages/
  shared/       Tipos + Zod schemas compartidos
  db/           Prisma schema + migraciones + seed
  report-templates/  Plantillas Handlebars para PDFs
  config/       eslint, tsconfig, tailwind preset
```

## Setup local

### Requisitos
- Node.js 20+ (este repo usa 20.18 — ver `.nvmrc`)
- pnpm 9.12+ (instalar: `npm install -g pnpm@9.12.0`)
- Docker Desktop (para Postgres + Redis locales)

Si estás en Windows y npm falla con ExecutionPolicy, usa Git Bash en lugar de PowerShell.

### Pasos

```bash
# 1. Instalar dependencias
pnpm install

# 2. Levantar Postgres + Redis
pnpm docker:up

# 3. Copiar variables de entorno
cp .env.example .env

# 4. Migrar base de datos y sembrar datos iniciales
pnpm db:migrate
pnpm db:seed

# 5. Arrancar API + Web + Worker
pnpm dev
```

- API: http://localhost:4000
- Web: http://localhost:3000
- Prisma Studio: `pnpm db:studio`

### Endpoints útiles en desarrollo

- API REST: http://localhost:4000/api/v1
- Swagger / OpenAPI: http://localhost:4000/docs
- Health: http://localhost:4000/health
- Web PWA: http://localhost:3000 (instalable desde Chrome/Edge móvil o desktop)
- Página offline: http://localhost:3000/offline

### Características de plataforma

- **Auth con rotación de refresh tokens** (detección de reuso, revocación cascada)
- **Multi-tenant guard** automático en endpoints sensibles vía `@ScopeOrg`
- **PWA instalable** con caché por estrategia (NetworkFirst API, CacheFirst static, SWR pages)
- **Dark mode** con respeto a `prefers-color-scheme` y override manual
- **Tests** Vitest en `apps/api`, `apps/web` y `packages/shared` (46 tests al cierre del hardening)
- **Pre-commit** hooks con husky + lint-staged (prettier auto-format)

## Scripts útiles

| Script | Descripción |
|---|---|
| `pnpm dev` | Arranca todos los apps en paralelo |
| `pnpm build` | Build de producción de todo el monorepo |
| `pnpm lint` | ESLint en todos los packages |
| `pnpm typecheck` | TypeScript check |
| `pnpm test` | Tests unitarios (Vitest) |
| `pnpm test:e2e` | Tests E2E (Playwright) |
| `pnpm db:migrate` | Migración Prisma en desarrollo |
| `pnpm db:seed` | Sembrar datos iniciales (admin, festivos, etc.) |
| `pnpm db:studio` | Abrir Prisma Studio |

## Roadmap

10 meses, 10 hitos. Ver plan completo en `C:\Users\resid\.claude\plans\contexto-eres-un-validated-salamander.md`.

- **M1** — Monorepo, auth, RBAC, CI/CD
- **M2** — Projects + users + audit + UI shell
- **M3-M4** — Módulo presupuesto (APU, AIU, baseline)
- **M5** — Importador XLSX heurístico
- **M6** — Cronograma + CPM + Gantt + curva S
- **M7** — Ventas + planes de pago
- **M8** — Flujo de caja + crédito constructor
- **M9** — Cambios + dashboard + alertas
- **M10** — Reportes PDF + hardening

## Licencia

Privado.
