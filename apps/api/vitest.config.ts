/**
 * Vitest configuration for apps/api integration / E2E tests.
 *
 * QA M3 (v0.2.0): Service-level integration tests against a real Postgres
 * (no Nest HTTP server booted). Tests import Nest services directly and
 * invoke them with a live `PrismaService`.
 *
 * Usage:
 *   pnpm --filter @nuxia2/api test:e2e
 *   # or
 *   pnpm exec vitest run --config apps/api/vitest.config.ts
 *
 * Requires:
 *   - Postgres reachable via `DATABASE_URL` (docker compose up -d postgres)
 *   - `prisma migrate deploy` (or `prisma migrate dev`) has been run
 *   - `APP_ENCRYPTION_KEY` (32-byte hex) in env (or `.env.test`)
 */
import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'test/**/*.test.ts',
      // Also pick up standalone scripts if they're flagged as tests
      '../../scripts/qa/**/*.test.ts',
    ],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    setupFiles: ['test/_setup.ts'],
    // Single fork → serial DB access; avoids flaky parallel truncation.
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    // `.env.test` will be loaded by `_setup.ts` via `dotenv` if present.
    reporters: process.env.CI ? ['default', 'junit'] : ['default'],
    outputFile: process.env.CI ? { junit: 'test-results/junit.xml' } : undefined,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@nuxia2/shared-types': path.resolve(__dirname, '../../packages/shared-types/src'),
    },
  },
})
