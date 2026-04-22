/**
 * QA M3 — CI / developer orchestration entry point.
 *
 * Delegates the actual test execution to vitest in apps/api. This wrapper:
 *   1. Prints a banner
 *   2. Verifies DATABASE_URL is reachable (quick check)
 *   3. Spawns `pnpm --filter @nuxia2/api test:e2e`
 *   4. Exits with the child process' status
 *
 * Usage:
 *   pnpm exec tsx scripts/qa/run-all.ts
 *
 * For the unit-level baseline (no DB needed) see:
 *   pnpm exec tsx scripts/qa/baseline-math.ts
 */
/* eslint-disable no-console */
import { spawnSync } from 'node:child_process'

function banner(msg: string) {
  const line = '='.repeat(Math.max(60, msg.length + 4))
  console.log(line)
  console.log(`  ${msg}`)
  console.log(line)
}

function main() {
  banner('Nuxia QA — E2E suite (vitest integration tests against real Postgres)')

  if (!process.env.DATABASE_URL) {
    console.warn(
      '[warn] DATABASE_URL is not set. Tests rely on `apps/api/test/_setup.ts` defaults — ' +
        'confirm your docker postgres is reachable at localhost:5432.',
    )
  }

  const isWin = process.platform === 'win32'
  const pnpm = isWin ? 'pnpm.cmd' : 'pnpm'
  const r = spawnSync(pnpm, ['--filter', '@nuxia2/api', 'test:e2e'], {
    stdio: 'inherit',
    shell: false,
  })

  if (r.status !== 0) {
    console.error('\n[qa] Suite FAILED — see output above.')
    process.exit(r.status ?? 1)
  }

  banner('✓ All E2E tests passed')
}

main()
