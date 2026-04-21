import { Injectable } from '@nestjs/common'
import { LedgerStatus, LedgerType, Prisma } from '@prisma/client'
import { PrismaService } from '../../common/prisma.module'
import { bi, iso } from '../../common/util/serialize.util'

/**
 * QA P0-03 / P0-04 / P0-05 / P1-01
 *
 *  - P0-03: Dashboard 응답 shape을 shared-types `DashboardResponseSchema` 와 1:1 매칭
 *           (expectedThisMonthKrw / byGeneration / summary / recent / tree)
 *  - P0-04: 월 경계를 KST(UTC+9) 기준으로 계산
 *  - P0-05: Tree 를 재귀 중첩 구조로 반환 (shared-types `TreeNodeSchema`)
 *  - P1-01: `expectedThisMonthKrw` = 이번 달 EARN 합계 - REVERT 합계 (순액)
 */
@Injectable()
export class ReferralDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * GET /referral/dashboard 의 주 응답.
   * shared-types `DashboardResponseSchema` 와 일치.
   */
  async getSummary(userId: string) {
    const monthStart = startOfMonthKst(new Date())
    const monthEnd = startOfNextMonthKst(new Date())

    const [
      gen1Agg,
      gen2Agg,
      gen3Agg,
      revertAgg,
      pendingAgg,
      withheldAgg,
      withheldCountAgg,
      revertCountAgg,
      recentRows,
      treeRoot,
    ] = await Promise.all([
      // 이번 달 세대별 EARN 합계 / orderCount (distinct orders)
      this.genAgg(userId, 1, monthStart, monthEnd),
      this.genAgg(userId, 2, monthStart, monthEnd),
      this.genAgg(userId, 3, monthStart, monthEnd),
      // 이번 달 REVERT 합계(음수)
      this.prisma.referralLedger.aggregate({
        where: {
          beneficiaryUserId: userId,
          type: LedgerType.REVERT,
          createdAt: { gte: monthStart, lt: monthEnd },
        },
        _sum: { amountKrw: true },
      }),
      // summary: 전체 PENDING 합계 (지급 예정)
      this.prisma.referralLedger.aggregate({
        where: { beneficiaryUserId: userId, status: LedgerStatus.PENDING, type: LedgerType.EARN },
        _sum: { amountKrw: true },
      }),
      // summary: 전체 SUSPENDED_FOR_REVIEW 합계 (유보)
      this.prisma.referralLedger.aggregate({
        where: {
          beneficiaryUserId: userId,
          status: LedgerStatus.SUSPENDED_FOR_REVIEW,
          type: LedgerType.EARN,
        },
        _sum: { amountKrw: true },
      }),
      // summary: 유보 건수
      this.prisma.referralLedger.count({
        where: {
          beneficiaryUserId: userId,
          status: LedgerStatus.SUSPENDED_FOR_REVIEW,
          type: LedgerType.EARN,
        },
      }),
      // summary: 역정산 건수
      this.prisma.referralLedger.count({
        where: { beneficiaryUserId: userId, type: LedgerType.REVERT },
      }),
      // recent (최신 10건)
      this.prisma.referralLedger.findMany({
        where: { beneficiaryUserId: userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      this.getTree(userId),
    ])

    // P1-01: 이번 달 순액 = EARN 합계(3세대) - |REVERT|
    const gen1Amt = gen1Agg.sum
    const gen2Amt = gen2Agg.sum
    const gen3Amt = gen3Agg.sum
    const earnSum = gen1Amt + gen2Amt + gen3Amt
    // REVERT는 음수로 저장되므로 부호 유지한 채 더하면 순액
    const revertSumNeg = revertAgg._sum.amountKrw ?? 0n // negative or 0
    const expected = earnSum + revertSumNeg

    return {
      expectedThisMonthKrw: bi(expected),
      byGeneration: {
        gen1: {
          rateBps: 300 as const,
          amountKrw: bi(gen1Amt),
          orderCount: gen1Agg.orderCount,
        },
        gen2: {
          rateBps: 500 as const,
          amountKrw: bi(gen2Amt),
          orderCount: gen2Agg.orderCount,
        },
        gen3: {
          rateBps: 1700 as const,
          amountKrw: bi(gen3Amt),
          orderCount: gen3Agg.orderCount,
        },
      },
      summary: {
        payableKrw: bi(pendingAgg._sum.amountKrw ?? 0n),
        withheldKrw: bi(withheldAgg._sum.amountKrw ?? 0n),
        // REVERT 합계는 음수이므로 절대값으로 노출
        revertedKrw: bi(revertSumNeg < 0n ? -revertSumNeg : 0n),
        withheldCount: withheldCountAgg,
        revertedCount: revertCountAgg,
      },
      recent: recentRows.map(serializeLedger),
      tree: treeRoot,
    }
  }

  /** 세대별 이번 달 EARN 합계 + distinct orderCount */
  private async genAgg(
    userId: string,
    gen: number,
    start: Date,
    end: Date,
  ): Promise<{ sum: bigint; orderCount: number }> {
    const [agg, distinct] = await Promise.all([
      this.prisma.referralLedger.aggregate({
        where: {
          beneficiaryUserId: userId,
          generation: gen,
          type: LedgerType.EARN,
          createdAt: { gte: start, lt: end },
        },
        _sum: { amountKrw: true },
      }),
      this.prisma.referralLedger.findMany({
        where: {
          beneficiaryUserId: userId,
          generation: gen,
          type: LedgerType.EARN,
          createdAt: { gte: start, lt: end },
        },
        select: { orderId: true },
        distinct: ['orderId'],
      }),
    ])
    return {
      sum: agg._sum.amountKrw ?? 0n,
      orderCount: distinct.length,
    }
  }

  /**
   * 재귀 중첩 트리 (shared-types `TreeNodeSchema`).
   * 루트(본인) + 하위 3세대 (= children 깊이 3).
   */
  async getTree(userId: string): Promise<TreeNodeDto> {
    const rows = await this.prisma.$queryRaw<RawTreeRow[]>(Prisma.sql`
      WITH RECURSIVE subtree AS (
        SELECT id, nickname, "referralCode", "referrerId", 0 AS depth,
               status, role, "createdAt"
          FROM "User" WHERE id = ${userId}
        UNION ALL
        SELECT u.id, u.nickname, u."referralCode", u."referrerId", s.depth + 1,
               u.status, u.role, u."createdAt"
          FROM "User" u
          JOIN subtree s ON u."referrerId" = s.id
         WHERE s.depth < 3
      )
      SELECT id, nickname, "referralCode", "referrerId", depth, status, role, "createdAt"
        FROM subtree
       ORDER BY depth ASC, "createdAt" ASC
    `)

    // 세대별 이번 달 기여도(구매자의 totalAmountKrw 합계)를 한 번에 조회
    const descendantIds = rows.filter((r) => r.depth > 0).map((r) => r.id)
    const monthStart = startOfMonthKst(new Date())
    const monthEnd = startOfNextMonthKst(new Date())
    const contributions = descendantIds.length
      ? await this.prisma.order.groupBy({
          by: ['userId'],
          where: {
            userId: { in: descendantIds },
            status: { in: ['PAID', 'PREPARING', 'SHIPPED', 'DELIVERED', 'CONFIRMED'] },
            createdAt: { gte: monthStart, lt: monthEnd },
          },
          _sum: { totalAmountKrw: true },
        })
      : []
    const contribMap = new Map<string, bigint>()
    for (const c of contributions) {
      contribMap.set(c.userId, c._sum.totalAmountKrw ?? 0n)
    }

    // 세대별 bps
    const bpsByGen: Record<number, number> = { 1: 300, 2: 500, 3: 1700 }

    // id → TreeNode 맵핑
    const nodeMap = new Map<string, TreeNodeDto>()
    for (const r of rows) {
      const contrib = contribMap.get(r.id) ?? 0n
      const gen = r.depth as 0 | 1 | 2 | 3
      const myEarn = gen === 0 ? 0n : (contrib * BigInt(bpsByGen[gen] ?? 0)) / 10_000n
      const blocked = deriveBlockedReason(r.status, r.role)
      nodeMap.set(r.id, {
        userId: r.id,
        nickname: r.nickname,
        referralCode: r.referralCode,
        generation: gen,
        blockedReason: blocked,
        joinedAt: iso(r.createdAt) ?? new Date().toISOString(),
        contributionThisMonthKrw: bi(contrib),
        myEarningThisMonthKrw: bi(myEarn),
        children: [],
      })
    }
    // 부모-자식 연결
    for (const r of rows) {
      if (r.depth === 0 || !r.referrerId) continue
      const parent = nodeMap.get(r.referrerId)
      const child = nodeMap.get(r.id)
      if (parent && child) parent.children.push(child)
    }
    return nodeMap.get(userId) ?? fallbackRoot(userId)
  }

  async getLedger(
    userId: string,
    { cursor, limit = 30 }: { cursor?: string; limit?: number } = {},
  ) {
    const lim = Math.min(limit, 100)
    const items = await this.prisma.referralLedger.findMany({
      where: { beneficiaryUserId: userId },
      take: lim + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
    })
    const nextCursor = items.length > lim ? items.pop()!.id : null
    return { items: items.map(serializeLedger), nextCursor }
  }
}

// --- helpers -----------------------------------------------------------

interface RawTreeRow {
  id: string
  nickname: string
  referralCode: string
  referrerId: string | null
  depth: number
  status: string
  role: string
  createdAt: Date
}

interface TreeNodeDto {
  userId: string
  nickname: string
  referralCode: string
  generation: 0 | 1 | 2 | 3
  blockedReason: 'SELF_REFERRAL' | 'STAFF' | 'SUSPENDED' | 'WITHDRAWN' | null
  joinedAt: string
  contributionThisMonthKrw: string
  myEarningThisMonthKrw: string
  children: TreeNodeDto[]
}

function deriveBlockedReason(
  status: string,
  role: string,
): TreeNodeDto['blockedReason'] {
  if (role === 'STAFF' || role === 'STAFF_FAMILY') return 'STAFF'
  if (status === 'WITHDRAWN') return 'WITHDRAWN'
  if (status === 'SUSPENDED' || status === 'BANNED' || status === 'UNDER_REVIEW')
    return 'SUSPENDED'
  return null
}

function serializeLedger(l: any) {
  return {
    id: l.id,
    orderId: l.orderId,
    beneficiaryUserId: l.beneficiaryUserId,
    generation: l.generation,
    rateBps: l.rateBps,
    amountKrw: bi(l.amountKrw),
    type: l.type,
    status: l.status,
    reason: l.reason ?? null,
    createdAt: iso(l.createdAt) ?? new Date().toISOString(),
  }
}

function fallbackRoot(userId: string): TreeNodeDto {
  return {
    userId,
    nickname: '',
    referralCode: '',
    generation: 0,
    blockedReason: null,
    joinedAt: new Date().toISOString(),
    contributionThisMonthKrw: '0',
    myEarningThisMonthKrw: '0',
    children: [],
  }
}

// --- KST month boundaries (P0-04) --------------------------------------
// KST = UTC+9. Asia/Seoul 에는 DST 가 없어 고정 오프셋으로 안전.
// `date-fns-tz` 를 직접 추가하지 않고 동등한 산술 연산 사용.

const KST_OFFSET_MS = 9 * 3_600_000

/** Returns UTC Date representing 1일 00:00:00.000 KST of `now`'s month. */
export function startOfMonthKst(now: Date): Date {
  const kst = new Date(now.getTime() + KST_OFFSET_MS)
  const y = kst.getUTCFullYear()
  const m = kst.getUTCMonth()
  // KST 1일 00:00 = UTC (1일 00:00 - 9h) = 전월 말일 15:00 UTC
  return new Date(Date.UTC(y, m, 1) - KST_OFFSET_MS)
}

/** Returns UTC Date representing 익월 1일 00:00:00.000 KST. */
export function startOfNextMonthKst(now: Date): Date {
  const kst = new Date(now.getTime() + KST_OFFSET_MS)
  const y = kst.getUTCFullYear()
  const m = kst.getUTCMonth()
  return new Date(Date.UTC(y, m + 1, 1) - KST_OFFSET_MS)
}
