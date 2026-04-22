import { Injectable } from '@nestjs/common'
import { AbuseKind, Prisma, UserRole, UserStatus } from '@prisma/client'
import { PrismaService } from '../../common/prisma.module'
import { PayoutService } from '../payout/payout.service'

/**
 * v0.4 M1 — Admin 서비스.
 *
 * 신규 메서드: getKpi / listUsers / getUser / listPayouts.
 * 기존 메서드는 유지 (flagUser / releaseMinor / markStaff / suspend / payouts 등).
 *
 * AuditLog 삽입은 기존 메서드에도 남아 있지만, v0.4 부터는
 * `@Audit(kind)` 데코레이터 + `AuditLogInterceptor` 로도 이중 보장된다.
 */
@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payouts: PayoutService,
  ) {}

  // ---------------------------------------------------------------------------
  // v0.4 M1 — GET /admin/kpi
  // ---------------------------------------------------------------------------

  /**
   * 이번 달 KST 월 경계(1일 00:00 ~ 다음달 1일 00:00) 기준 4종 KPI.
   * - blockedThisMonth: AbuseLog count (this month)
   * - pendingPayoutKrw: PENDING + WITHHELD Payout 의 amountNetKrw 합계 (BigIntString)
   * - minorHoldCount: User(status=MINOR_HOLD) count
   * - activeUserCount: User(role=CUSTOMER + status=ACTIVE) count
   */
  async getKpi() {
    const { start, end } = kstMonthBounds(new Date())

    const [blocked, pendingAgg, minorHold, active] = await Promise.all([
      this.prisma.abuseLog.count({
        where: { detectedAt: { gte: start, lt: end } },
      }),
      this.prisma.payout.aggregate({
        where: { status: { in: ['PENDING', 'WITHHELD'] } },
        _sum: { amountNetKrw: true },
      }),
      this.prisma.user.count({ where: { status: UserStatus.MINOR_HOLD } }),
      this.prisma.user.count({
        where: { role: UserRole.CUSTOMER, status: UserStatus.ACTIVE },
      }),
    ])

    const pendingPayoutKrw = (pendingAgg._sum.amountNetKrw ?? 0n).toString()
    return {
      blockedThisMonth: blocked,
      pendingPayoutKrw,
      minorHoldCount: minorHold,
      activeUserCount: active,
    }
  }

  // ---------------------------------------------------------------------------
  // v0.4 M1 — GET /admin/users?query=&cursor=&limit=
  // ---------------------------------------------------------------------------

  async listUsers(params: { query?: string; cursor?: string; limit?: number }) {
    const take = Math.min(Math.max(params.limit ?? 20, 1), 100)
    const q = params.query?.trim()
    const where: Prisma.UserWhereInput = q
      ? {
          OR: [
            { email: { contains: q, mode: 'insensitive' } },
            { nickname: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {}

    const rows = await this.prisma.user.findMany({
      where,
      take: take + 1,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    })
    const hasNext = rows.length > take
    const page = hasNext ? rows.slice(0, take) : rows
    const nextCursor = hasNext ? rows[take - 1]!.id : null

    // flaggedCount 는 개별 user 별 count → 배치로 묶어서 1 쿼리.
    const ids = page.map((u) => u.id)
    const flagRows = ids.length
      ? await this.prisma.abuseLog.groupBy({
          by: ['primaryUserId'],
          where: { primaryUserId: { in: ids } },
          _count: { _all: true },
        })
      : []
    const flagCountByUser = new Map<string, number>()
    for (const r of flagRows) {
      if (r.primaryUserId) flagCountByUser.set(r.primaryUserId, r._count._all)
    }

    return {
      items: page.map((u) => serializeAdminUser(u, flagCountByUser.get(u.id) ?? 0)),
      nextCursor,
    }
  }

  // ---------------------------------------------------------------------------
  // v0.4 M1 — GET /admin/users/:id
  // ---------------------------------------------------------------------------

  async getUser(id: string) {
    const u = await this.prisma.user.findUnique({ where: { id } })
    if (!u) return null
    const flaggedCount = await this.prisma.abuseLog.count({
      where: { primaryUserId: id },
    })
    return serializeAdminUser(u, flaggedCount)
  }

  // ---------------------------------------------------------------------------
  // v0.4 M1 — GET /admin/payouts?cursor=&limit=
  // ---------------------------------------------------------------------------

  async listPayouts(params: { cursor?: string; limit?: number }) {
    const take = Math.min(Math.max(params.limit ?? 20, 1), 100)
    const rows = await this.prisma.payout.findMany({
      take: take + 1,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    })
    const hasNext = rows.length > take
    const page = hasNext ? rows.slice(0, take) : rows
    const nextCursor = hasNext ? rows[take - 1]!.id : null
    return { items: page.map(serializePayout), nextCursor }
  }

  // ---------------------------------------------------------------------------
  // 기존 메서드 (v0.2~v0.3). @Audit interceptor 와 이중 기록.
  // ---------------------------------------------------------------------------

  async listAbuseLogs(params: {
    kind?: AbuseKind
    from?: Date
    to?: Date
    limit?: number
    cursor?: string
  }) {
    const take = Math.min(params.limit ?? 100, 500)
    const items = await this.prisma.abuseLog.findMany({
      where: {
        ...(params.kind ? { kind: params.kind } : {}),
        ...(params.from || params.to
          ? { detectedAt: { gte: params.from, lte: params.to } }
          : {}),
      },
      take: take + 1,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
      orderBy: { detectedAt: 'desc' },
    })
    const nextCursor = items.length > take ? items.pop()!.id : null
    return { items, nextCursor }
  }

  async getUserTree(rootId: string) {
    const root = await this.prisma.user.findUnique({
      where: { id: rootId },
      select: {
        id: true, nickname: true, referralCode: true, status: true, role: true, createdAt: true,
      },
    })
    if (!root) return null

    const depth1 = await this.prisma.user.findMany({
      where: { referrerId: rootId },
      select: { id: true, nickname: true, referralCode: true, status: true, role: true, createdAt: true },
    })
    const depth1Ids = depth1.map((u) => u.id)

    const depth2 = depth1Ids.length
      ? await this.prisma.user.findMany({
          where: { referrerId: { in: depth1Ids } },
          select: {
            id: true, nickname: true, referralCode: true, status: true, role: true,
            referrerId: true, createdAt: true,
          },
        })
      : []
    const depth2Ids = depth2.map((u) => u.id)

    const depth3 = depth2Ids.length
      ? await this.prisma.user.findMany({
          where: { referrerId: { in: depth2Ids } },
          select: {
            id: true, nickname: true, referralCode: true, status: true, role: true,
            referrerId: true, createdAt: true,
          },
        })
      : []

    const grandchildrenOf = (parentId: string) =>
      depth3.filter((u) => u.referrerId === parentId).map((u) => ({
        ...u,
        children: [],
      }))
    const childrenOf = (parentId: string) =>
      depth2
        .filter((u) => u.referrerId === parentId)
        .map((u) => ({ ...u, children: grandchildrenOf(u.id) }))

    return {
      ...root,
      children: depth1.map((u) => ({ ...u, children: childrenOf(u.id) })),
    }
  }

  async flagUser(userId: string, actorId: string, reason: string) {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { status: UserStatus.UNDER_REVIEW },
    })
    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: 'USER_FLAG_REVIEW',
        target: `User:${userId}`,
        reason,
      },
    })
    return updated
  }

  async markStaff(userId: string, role: UserRole, actorId: string) {
    if (role !== 'STAFF' && role !== 'STAFF_FAMILY' && role !== 'CUSTOMER') {
      throw new Error('Invalid role for mark')
    }
    const updated = await this.prisma.user.update({ where: { id: userId }, data: { role } })
    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: 'USER_MARK_STAFF',
        target: `User:${userId}`,
        payload: { role },
      },
    })
    return updated
  }

  async suspendUser(userId: string, actorId: string, reason: string) {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { status: UserStatus.SUSPENDED },
    })
    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: 'USER_SUSPEND',
        target: `User:${userId}`,
        reason,
      },
    })
    return updated
  }

  async releaseMinor(userId: string, actorId: string) {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { status: UserStatus.ACTIVE, payoutEligibility: true },
    })
    await this.prisma.auditLog.create({
      data: { actorId, action: 'USER_RELEASE_MINOR', target: `User:${userId}` },
    })
    return updated
  }

  async runPayout(periodStart: string, periodEnd: string, actorId: string) {
    const res = await this.payouts.runMonthly(new Date(periodStart), new Date(periodEnd))
    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: 'PAYOUT_RUN',
        payload: { periodStart, periodEnd, created: res.created },
      },
    })
    return res
  }

  async releasePayout(payoutId: string, actorId: string) {
    const p = await this.payouts.release(payoutId)
    await this.prisma.auditLog.create({
      data: { actorId, action: 'PAYOUT_RELEASE', target: `Payout:${payoutId}` },
    })
    return p
  }
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

/** KST(+09:00) 월 경계 계산. */
export function kstMonthBounds(now: Date): { start: Date; end: Date } {
  const KST_OFFSET_MS = 9 * 60 * 60 * 1000
  const kst = new Date(now.getTime() + KST_OFFSET_MS)
  const y = kst.getUTCFullYear()
  const m = kst.getUTCMonth()
  // month start in KST → convert back to UTC
  const startUtc = new Date(Date.UTC(y, m, 1) - KST_OFFSET_MS)
  const endUtc = new Date(Date.UTC(y, m + 1, 1) - KST_OFFSET_MS)
  return { start: startUtc, end: endUtc }
}

/** `ciHash` 앞 1자 + x7. 평문 ci 미출력. */
function maskCi(u: { ciHash: string | null; ci: string | null }): string {
  const h = u.ciHash ?? ''
  if (!h) return 'xxxxxxxx'
  return `${h.charAt(0)}xxxxxxx`
}

function serializeAdminUser(u: any, flaggedCount: number) {
  return {
    id: u.id,
    email: u.email,
    nickname: u.nickname,
    role: u.role,
    status: u.status,
    ciMasked: maskCi(u),
    identityVerified: !!u.ciHash,
    payoutEligibility: !!u.payoutEligibility,
    flaggedCount,
    createdAt: u.createdAt instanceof Date ? u.createdAt.toISOString() : u.createdAt,
    lastLoginAt: u.lastLoginAt instanceof Date ? u.lastLoginAt.toISOString() : (u.lastLoginAt ?? null),
    withdrawnAt: u.withdrawnAt instanceof Date ? u.withdrawnAt.toISOString() : (u.withdrawnAt ?? null),
  }
}

function serializePayout(p: any) {
  return {
    id: p.id,
    userId: p.userId,
    periodStart: p.periodStart instanceof Date ? p.periodStart.toISOString() : p.periodStart,
    periodEnd: p.periodEnd instanceof Date ? p.periodEnd.toISOString() : p.periodEnd,
    amountGrossKrw: (p.amountGrossKrw ?? 0n).toString(),
    amountTaxKrw: (p.amountTaxKrw ?? 0n).toString(),
    amountNetKrw: (p.amountNetKrw ?? 0n).toString(),
    status: p.status,
    bankMaskedAccount: p.bankMaskedAccount ?? null,
    paidAt: p.processedAt instanceof Date ? p.processedAt.toISOString() : (p.processedAt ?? null),
  }
}
