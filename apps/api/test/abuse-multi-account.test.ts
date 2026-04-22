/**
 * M3-4: 어뷰징 A3 + T5 + T6
 *  - A3: 동일 ci 재가입 → DUPLICATE_CI
 *  - T5: WITHDRAWN 상태 + 30일 쿨다운 내 재가입 → WITHDRAW_REJOIN_COOLDOWN
 *  - T6: STAFF referrer 로 회원가입 → STAFF_REFERRAL_FORBIDDEN
 */
import { beforeAll, describe, it, expect } from 'vitest'
import { UserRole, UserStatus } from '@prisma/client'
import { prisma } from './_setup'
import { makeServices, clearAll, createUser, uniqueCi } from './fixtures'

const svc = makeServices()

describe('A3 — 동일 ci 중복 가입 (DUPLICATE_CI)', () => {
  beforeAll(async () => {
    await clearAll()
  })

  it('동일 ci 로 두 번째 가입 시 409 USER_CI_DUPLICATE + AbuseLog(DUPLICATE_CI)', async () => {
    const ci = uniqueCi('dup')
    await createUser(svc, { ci })

    await expect(
      svc.user.createUser({
        email: 'two@test.local',
        passwordHash: 'x',
        nickname: 'two',
        ci,
      }),
    ).rejects.toMatchObject({
      response: { code: 'USER_CI_DUPLICATE' },
    })

    const logs = await prisma.abuseLog.findMany({ where: { kind: 'DUPLICATE_CI' } })
    expect(logs.length).toBeGreaterThanOrEqual(1)
  })
})

describe('T5 — WITHDRAWN 상태 30일 쿨다운', () => {
  beforeAll(async () => {
    await clearAll()
  })

  it('탈퇴 직후 재가입 시도 → 409 WITHDRAW_REJOIN_COOLDOWN', async () => {
    const ci = uniqueCi('wd')
    const u = await createUser(svc, { ci })

    // 탈퇴 처리 (withdrawnAt = 지금)
    await prisma.user.update({
      where: { id: u.id },
      data: { status: UserStatus.WITHDRAWN, withdrawnAt: new Date() },
    })

    await expect(
      svc.user.createUser({
        email: 'wd2@test.local',
        passwordHash: 'x',
        nickname: 'wd2',
        ci,
      }),
    ).rejects.toMatchObject({
      response: { code: 'WITHDRAW_REJOIN_COOLDOWN' },
    })

    const logs = await prisma.abuseLog.findMany({
      where: { kind: 'WITHDRAW_REJOIN_COOLDOWN' },
    })
    expect(logs.length).toBeGreaterThanOrEqual(1)
  })

  it('탈퇴 후 31일 경과 재가입 → 정상 처리 (쿨다운 해제)', async () => {
    await clearAll()
    const ci = uniqueCi('wd_ok')
    const u = await createUser(svc, { ci })

    // withdrawnAt = 31일 전
    const past = new Date(Date.now() - 31 * 86_400_000)
    await prisma.user.update({
      where: { id: u.id },
      data: { status: UserStatus.WITHDRAWN, withdrawnAt: past },
    })

    // 새 가입 — 통과해야 함 (예외 없음)
    const re = await svc.user.createUser({
      email: 'wd_ok2@test.local',
      passwordHash: 'x',
      nickname: 'wd_ok2',
      ci,
    })
    expect(re.id).toBeTruthy()
    // 구 row 와 다른 id 여야
    expect(re.id).not.toBe(u.id)
  })
})

describe('T6 — STAFF referrer 차단', () => {
  beforeAll(async () => {
    await clearAll()
  })

  it('STAFF 계정을 referrer 로 지정 시 403 STAFF_REFERRAL_FORBIDDEN', async () => {
    const staff = await createUser(svc, { role: UserRole.STAFF, skipSignup: true })

    await expect(
      svc.user.createUser({
        email: 'under-staff@test.local',
        passwordHash: 'x',
        nickname: 'under',
        ci: uniqueCi('under'),
        referralCode: staff.referralCode,
      }),
    ).rejects.toMatchObject({
      response: { code: 'STAFF_REFERRAL_FORBIDDEN' },
    })

    const logs = await prisma.abuseLog.findMany({ where: { kind: 'STAFF_REFERRAL' } })
    expect(logs.length).toBeGreaterThanOrEqual(1)
  })

  it('STAFF_FAMILY 역시 차단', async () => {
    await clearAll()
    const fam = await createUser(svc, { role: UserRole.STAFF_FAMILY, skipSignup: true })

    await expect(
      svc.user.createUser({
        email: 'under-fam@test.local',
        passwordHash: 'x',
        nickname: 'underfam',
        ci: uniqueCi('fam'),
        referralCode: fam.referralCode,
      }),
    ).rejects.toMatchObject({ response: { code: 'STAFF_REFERRAL_FORBIDDEN' } })
  })

  it('STAFF 구매자(buyer) 주문 시 referral.distribute 는 skip (상위 수익 없음)', async () => {
    await clearAll()
    const A = await createUser(svc) // 상위
    const staffBuyer = await createUser(svc, {
      role: UserRole.STAFF,
      referrerId: A.id,
      skipSignup: true,
    })

    const order = await prisma.order.create({
      data: {
        userId: staffBuyer.id,
        totalAmountKrw: 1_000_000n,
        subtotalAmountKrw: 1_000_000n,
        couponDiscountKrw: 0n,
        pointUsedKrw: 0n,
        shippingFeeKrw: 0n,
        status: 'PENDING_PAYMENT',
        paymentId: `payment_staff_${Date.now()}`,
      },
    })

    const result = await prisma.$transaction(async (tx) => {
      return svc.referral.distribute(tx, order.id)
    })
    expect(result.created).toBe(0)
    expect(result.skipped).toBeGreaterThanOrEqual(3)
  })
})
