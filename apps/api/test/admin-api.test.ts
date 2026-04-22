/**
 * v0.4 M1 — Admin BE 신규 엔드포인트 테스트.
 *
 *  - GET /admin/kpi
 *  - GET /admin/users (search + cursor)
 *  - GET /admin/users/:id
 *  - GET /admin/payouts
 *
 * 서비스 레이어를 직접 호출 (HTTP 스택 우회). 인증/권한은 단위 테스트 범위 밖.
 */
import { beforeAll, describe, it, expect } from 'vitest'
import { PayoutStatus, UserStatus } from '@prisma/client'
import { prisma } from './_setup'
import { makeServices, clearAll, createUser } from './fixtures'
import { AdminService } from '../src/modules/admin/admin.service'
import { PayoutService } from '../src/modules/payout/payout.service'
import { PrismaService } from '../src/common/prisma.module'

describe('Admin API — v0.4 M1', () => {
  let adminSvc: AdminService

  beforeAll(async () => {
    await clearAll()
    const prismaSvc = prisma as unknown as PrismaService
    const payoutSvc = new PayoutService(prismaSvc)
    adminSvc = new AdminService(prismaSvc, payoutSvc)
  })

  it('GET /admin/kpi — 4개 KPI 반환 (KST 월 경계, BigIntString 포함)', async () => {
    const svc = makeServices()
    const A = await createUser(svc)
    await createUser(svc, { referrerId: A.id })
    await createUser(svc, { referrerId: A.id, status: UserStatus.MINOR_HOLD })

    // abuse 1건
    await prisma.abuseLog.create({
      data: {
        kind: 'SELF_REFERRAL',
        primaryUserId: A.id,
        relatedUserIds: [],
        relatedOrderIds: [],
        evidence: { note: 'test' },
      },
    })
    // payout 1건 PENDING
    await prisma.payout.create({
      data: {
        userId: A.id,
        periodStart: new Date('2026-04-01'),
        periodEnd: new Date('2026-04-30'),
        amountGrossKrw: 10_000n,
        amountTaxKrw: 330n,
        amountNetKrw: 9_670n,
        status: PayoutStatus.PENDING,
      },
    })

    const kpi = await adminSvc.getKpi()
    expect(typeof kpi.blockedThisMonth).toBe('number')
    expect(kpi.blockedThisMonth).toBeGreaterThanOrEqual(1)
    expect(typeof kpi.pendingPayoutKrw).toBe('string')
    expect(/^\d+$/.test(kpi.pendingPayoutKrw)).toBe(true)
    expect(BigInt(kpi.pendingPayoutKrw)).toBeGreaterThanOrEqual(9_670n)
    expect(kpi.minorHoldCount).toBeGreaterThanOrEqual(1)
    expect(kpi.activeUserCount).toBeGreaterThanOrEqual(2)
  })

  it('GET /admin/users — query 검색 + cursor 페이지네이션', async () => {
    await clearAll()
    const svc = makeServices()
    for (let i = 0; i < 5; i++) {
      await createUser(svc, { nickname: `target_${i}`, email: `target_${i}@test.local` })
    }
    for (let i = 0; i < 3; i++) {
      await createUser(svc, { nickname: `other_${i}`, email: `other_${i}@test.local` })
    }

    // 1) query 필터
    const hits = await adminSvc.listUsers({ query: 'target' })
    expect(hits.items.length).toBe(5)
    expect(hits.items.every((u) => u.nickname.startsWith('target_'))).toBe(true)

    // 2) cursor 페이지네이션 (limit=3 → 다음 커서 존재)
    const page1 = await adminSvc.listUsers({ query: 'target', limit: 3 })
    expect(page1.items.length).toBe(3)
    expect(page1.nextCursor).not.toBeNull()
    const page2 = await adminSvc.listUsers({
      query: 'target',
      limit: 3,
      cursor: page1.nextCursor!,
    })
    expect(page2.items.length).toBeGreaterThan(0)
    // 두 페이지 간 id 중복 없음
    const ids1 = new Set(page1.items.map((u) => u.id))
    expect(page2.items.every((u) => !ids1.has(u.id))).toBe(true)

    // 3) ciMasked 형식
    for (const u of page1.items) {
      expect(u.ciMasked.length).toBeGreaterThan(0)
      expect(u.ciMasked.slice(1)).toMatch(/^x+$/)
    }
  })

  it('GET /admin/users/:id — ciMasked + flaggedCount 반환', async () => {
    await clearAll()
    const svc = makeServices()
    const A = await createUser(svc)
    // 3 abuse logs for A
    for (const kind of ['SELF_REFERRAL', 'CIRCULAR', 'DUPLICATE_CI'] as const) {
      await prisma.abuseLog.create({
        data: {
          kind,
          primaryUserId: A.id,
          relatedUserIds: [],
          relatedOrderIds: [],
          evidence: {},
        },
      })
    }

    const row = await adminSvc.getUser(A.id)
    expect(row).not.toBeNull()
    expect(row!.id).toBe(A.id)
    expect(row!.flaggedCount).toBe(3)
    expect(row!.ciMasked.length).toBeGreaterThan(1)
    expect(row!.ciMasked.slice(1)).toMatch(/^x+$/)
    // 민감 필드 비노출
    expect((row as any).ci).toBeUndefined()
    expect((row as any).ciHash).toBeUndefined()
    expect((row as any).passwordHash).toBeUndefined()
  })

  it('GET /admin/payouts — 커서 기반 페이지네이션', async () => {
    await clearAll()
    const svc = makeServices()
    const A = await createUser(svc)
    // 5 payouts
    for (let i = 0; i < 5; i++) {
      await prisma.payout.create({
        data: {
          userId: A.id,
          periodStart: new Date(Date.UTC(2026, 0, 1 + i)),
          periodEnd: new Date(Date.UTC(2026, 0, 2 + i)),
          amountGrossKrw: BigInt(1000 * (i + 1)),
          amountTaxKrw: 0n,
          amountNetKrw: BigInt(1000 * (i + 1)),
          status: PayoutStatus.PENDING,
        },
      })
    }
    const page1 = await adminSvc.listPayouts({ limit: 3 })
    expect(page1.items.length).toBe(3)
    expect(page1.nextCursor).not.toBeNull()
    for (const p of page1.items) {
      expect(typeof p.amountGrossKrw).toBe('string')
      expect(typeof p.amountNetKrw).toBe('string')
    }
    const page2 = await adminSvc.listPayouts({ limit: 3, cursor: page1.nextCursor! })
    expect(page2.items.length).toBeGreaterThan(0)
  })
})
