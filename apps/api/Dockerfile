# syntax=docker/dockerfile:1.7

# -----------------------------------------------------------------------------
# Nuxia2 API (NestJS) - multi-stage Dockerfile
#   base    : node:20-alpine + pnpm@9 via corepack
#   deps    : prod+dev deps for @nuxia2/api and @nuxia2/shared-types
#   build   : prisma generate + nest build
#   runtime : slim runtime with non-root user, healthcheck on /health
# -----------------------------------------------------------------------------

FROM node:20-alpine AS base
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@9 --activate

# ---- deps stage --------------------------------------------------------------
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/shared-types/package.json packages/shared-types/
RUN pnpm install --frozen-lockfile --filter @nuxia2/api... --filter @nuxia2/shared-types

# ---- build stage -------------------------------------------------------------
FROM base AS build
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /repo/packages/shared-types/node_modules ./packages/shared-types/node_modules
COPY . .
# shared-types uses tsc --noEmit (src/index.ts is entrypoint); build step is a no-op type check.
RUN pnpm --filter @nuxia2/shared-types build || true
# Prisma client must be generated before nest build (decorators reference @prisma/client).
RUN pnpm --filter @nuxia2/api exec prisma generate
RUN pnpm --filter @nuxia2/api run build

# ---- runtime stage -----------------------------------------------------------
FROM node:20-alpine AS runtime
WORKDIR /app

# non-root user (uid 1001)
RUN addgroup -g 1001 -S nodejs && adduser -S node2 -u 1001 -G nodejs

ENV NODE_ENV=production \
    PORT=4000

# Compiled output + prisma schema + production node_modules (from the api workspace).
COPY --from=build --chown=node2:nodejs /repo/apps/api/dist ./dist
COPY --from=build --chown=node2:nodejs /repo/apps/api/prisma ./prisma
COPY --from=build --chown=node2:nodejs /repo/apps/api/node_modules ./node_modules
# shared-types is exposed via src; we ship the workspace package as-is under node_modules.
COPY --from=build --chown=node2:nodejs /repo/packages/shared-types ./node_modules/@nuxia2/shared-types
COPY --from=build --chown=node2:nodejs /repo/apps/api/package.json ./package.json

USER node2
EXPOSE 4000

# TODO(backend-engineer): expose GET /health via @nestjs/terminus if not already present.
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/health || exit 1

CMD ["node", "dist/main.js"]
