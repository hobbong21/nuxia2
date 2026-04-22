/**
 * Global test setup — boot a real PrismaClient connected to the dev DB,
 * seed sensible env vars, and expose a `prisma` singleton to all test files.
 *
 * Tests are expected to TRUNCATE the tables they touch inside `beforeAll`
 * (see `fixtures.ts#clearAll`). They do NOT drop the schema — `prisma migrate
 * deploy` must have been run by the operator (or via `make db-migrate`).
 */
import { beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'

// --------------------------------------------------------------------------
// env loading — minimal .env.test loader (avoids adding `dotenv` dep)
// --------------------------------------------------------------------------
function loadDotEnv(fp: string) {
  if (!existsSync(fp)) return
  const src = readFileSync(fp, 'utf8')
  for (const raw of src.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/)
    if (!m) continue
    const [, k, vRaw] = m
    const v = vRaw.replace(/^['"]|['"]$/g, '')
    if (process.env[k] == null) process.env[k] = v
  }
}
loadDotEnv(path.resolve(__dirname, '..', '.env.test'))
loadDotEnv(path.resolve(__dirname, '..', '.env'))

// Baseline defaults so tests don't crash if env not provided.
process.env.DATABASE_URL ??=
  'postgresql://nuxia:nuxia@localhost:5432/nuxia?schema=public'
// A deterministic 32-byte hex key so crypto.util works under tests.
process.env.APP_ENCRYPTION_KEY ??=
  '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff'
process.env.APP_ENCRYPTION_SALT ??= 'nuxia-test-salt'
process.env.WITHDRAW_COOLDOWN_DAYS ??= '30'
process.env.HOLD_DAYS ??= '7'
process.env.PORTONE_STORE_ID ??= 'store-test'
process.env.PORTONE_API_SECRET ??= 'test-secret'

// --------------------------------------------------------------------------
// Global Prisma instance
// --------------------------------------------------------------------------
export const prisma = new PrismaClient({
  log: process.env.DEBUG_PRISMA ? ['query', 'warn', 'error'] : ['warn', 'error'],
})

beforeAll(async () => {
  await prisma.$connect()
  // Health ping — surfaces DATABASE_URL misconfig early with a clear message.
  try {
    await prisma.$queryRawUnsafe('SELECT 1')
  } catch (e) {
    throw new Error(
      `[qa-setup] Cannot reach Postgres via DATABASE_URL=${process.env.DATABASE_URL}. ` +
        `Start docker (make docker-up) and run migrations (make db-migrate) before running tests.\n` +
        `Underlying error: ${(e as Error).message}`,
    )
  }
})

afterAll(async () => {
  await prisma.$disconnect()
})
