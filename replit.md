# Nuxia2 — Commerce × 3-Generation Referral

## Overview
A Korean e-commerce platform with a 3-generation referral/commission system. Built as a pnpm monorepo.

## Architecture

| App | Stack | Port |
|-----|-------|------|
| `apps/web` | Next.js 14, React 18, TailwindCSS, Zustand, TanStack Query | 5000 |
| `apps/api` | NestJS 10, Prisma 5, PostgreSQL, Passport/JWT | 4000 (not in active workflow) |
| `packages/shared-types` | Shared TypeScript types and Zod schemas | — |

## Running on Replit
- **Package manager**: pnpm 10.26.1 (system version — `packageManager` field updated from 9.12.0)
- **Workflow**: "Start application" — installs deps and runs `next dev -p 5000 -H 0.0.0.0`
- **Database**: Replit PostgreSQL (DATABASE_URL auto-provisioned). All migrations applied.

## Environment Variables
Non-sensitive config is set in `.replit` `[userenv.shared]`. Secrets required:
- `DATABASE_URL` — auto-provided by Replit PostgreSQL
- `JWT_SECRET` — at least 32 chars, for auth token signing
- `PORTONE_API_SECRET` — PortOne V2 payment API secret
- `PORTONE_STORE_ID` — PortOne store ID
- `PORTONE_WEBHOOK_SECRET` — PortOne webhook HMAC secret

Optional secrets for full feature set:
- `SMS_API_KEY` / `SMS_API_SECRET` / `SMS_FROM_NUMBER` — Solapi SMS
- `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` — Email delivery

## Key Changes Made for Replit
1. `package.json` — `packageManager` updated to `pnpm@10.26.1` (matched system version)
2. `package.json` — Added `pnpm.onlyBuiltDependencies` to allow postinstall scripts for NestJS/Prisma/esbuild
3. `apps/web/next.config.mjs` — Added `allowedDevOrigins` for all `*.replit.dev` / `*.replit.app` / `*.spock.replit.dev` domains
4. `apps/web/package.json` — `dev`/`start` scripts now bind to port 5000 and `0.0.0.0`
5. `apps/api/prisma/schema.prisma` — Fixed invalid `/** */` JSDoc comments inside model blocks → `///` Prisma doc comments

## Development Notes
- Redis (BullMQ) is listed as a dependency in `apps/api` but not actively used in app module — no Redis provisioning needed for basic operation
- The API (`apps/api`) is a NestJS backend not included in the active dev workflow. To run it, set all required secrets and add a separate workflow for `apps/api`
- Mobile app (`apps/mobile`) uses Capacitor for hybrid builds — not applicable in Replit web environment
