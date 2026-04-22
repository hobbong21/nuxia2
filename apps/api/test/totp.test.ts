/**
 * v0.4 M5-BE — TOTP 테스트.
 *
 *  - setup: DB 에 암호화된 secret 저장 + enabled=false
 *  - verify: 올바른 코드 → enabled=true
 *  - disable: 코드 검증 후 enabled=false
 */
import { beforeAll, describe, it, expect } from 'vitest'
import { prisma } from './_setup'
import { makeServices, clearAll, createUser } from './fixtures'
import { TotpService, totpFor } from '../src/modules/auth/totp.service'
import { PrismaService } from '../src/common/prisma.module'

describe('TOTP — v0.4 M5-BE', () => {
  let totp: TotpService

  beforeAll(async () => {
    await clearAll()
    totp = new TotpService(prisma as unknown as PrismaService)
  })

  it('setup: base32 secret + otpauth URL 생성 + DB 저장', async () => {
    const svc = makeServices()
    const A = await createUser(svc)
    const out = await totp.generateSecret(A.id)
    expect(out.secret).toMatch(/^[A-Z2-7]+$/)
    expect(out.otpauthUrl.startsWith('otpauth://totp/')).toBe(true)
    expect(out.qrDataUri.startsWith('data:')).toBe(true)

    const row = await prisma.user.findUnique({ where: { id: A.id } })
    expect(row).not.toBeNull()
    expect((row as any).totpSecret).not.toBeNull()
    expect((row as any).totpEnabled).toBe(false)
  })

  it('verify: 올바른 6자리 코드 → totpEnabled=true', async () => {
    const svc = makeServices()
    const A = await createUser(svc)
    const { secret } = await totp.generateSecret(A.id)
    const code = totpFor(secret)
    const res = await totp.verifyAndEnable(A.id, code)
    expect(res.enabled).toBe(true)
    const row = await prisma.user.findUnique({ where: { id: A.id } })
    expect((row as any).totpEnabled).toBe(true)
    expect((row as any).totpEnabledAt).not.toBeNull()
  })

  it('disable: 현재 코드로 검증 후 비활성 + secret null', async () => {
    const svc = makeServices()
    const A = await createUser(svc)
    const { secret } = await totp.generateSecret(A.id)
    await totp.verifyAndEnable(A.id, totpFor(secret))

    // wrong code → throws
    let threw = false
    try {
      await totp.disable(A.id, '000000')
    } catch {
      threw = true
    }
    expect(threw).toBe(true)

    const right = totpFor(secret)
    const res = await totp.disable(A.id, right)
    expect(res.enabled).toBe(false)
    const row = await prisma.user.findUnique({ where: { id: A.id } })
    expect((row as any).totpEnabled).toBe(false)
    expect((row as any).totpSecret).toBeNull()
  })
})
