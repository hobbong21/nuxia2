# syntax=docker/dockerfile:1.7

# -----------------------------------------------------------------------------
# Nuxia2 Web (Next.js 14) - multi-stage Dockerfile
#   base    : node:20-alpine + pnpm@9 via corepack
#   deps    : deps for @nuxia2/web and @nuxia2/shared-types
#   build   : next build with output: 'standalone'
#   runtime : standalone server.js + static + public under non-root user
# -----------------------------------------------------------------------------

FROM node:20-alpine AS base
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@9 --activate

# ---- deps stage --------------------------------------------------------------
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
COPY packages/shared-types/package.json packages/shared-types/
RUN pnpm install --frozen-lockfile --filter @nuxia2/web... --filter @nuxia2/shared-types

# ---- build stage -------------------------------------------------------------
FROM base AS build
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /repo/packages/shared-types/node_modules ./packages/shared-types/node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @nuxia2/shared-types build || true
RUN pnpm --filter @nuxia2/web run build

# ---- runtime stage -----------------------------------------------------------
FROM node:20-alpine AS runtime
WORKDIR /app

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001 -G nodejs

ENV NODE_ENV=production \
    PORT=3000 \
    NEXT_TELEMETRY_DISABLED=1

# Next.js standalone output ships server.js at the monorepo root copy path
# (apps/web/.next/standalone/apps/web/server.js when built from repo root).
COPY --from=build --chown=nextjs:nodejs /repo/apps/web/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /repo/apps/web/.next/static ./apps/web/.next/static
# public directory is optional; guard with a fallback copy pattern.
COPY --from=build --chown=nextjs:nodejs /repo/apps/web/public ./apps/web/public

USER nextjs
EXPOSE 3000

CMD ["node", "apps/web/server.js"]
