import { Injectable, Logger } from '@nestjs/common'
import { LedgerStatus, LedgerType, Prisma, UserRole, UserStatus } from '@prisma/client'
import { PrismaService } from '../../common/prisma.module'
import { floorBps } from '../../common/util/money.util'

// Absolute contract: 1대 3% / 2대 5% / 3대 17% = 25%
export const GENERATIONS: ReadonlyArray<{ gen: number; bps: number }> = [
  { gen: 1, bps: 300 },
  { gen: 2, bps: 500 },
  { gen: 3, bps: 1700 },
]

@Injectable()
export class ReferralEngineService {
  private readonly logger = new Logger('ReferralEngine')

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Fetch up to 3 ancestor referrers for a given user.
   * Uses recursive CTE. Returns [{ id, gen }] where gen ∈ {1, 2, 3}.
   */
  async getAncestors(
    tx: Prisma.TransactionClient,
    userId: string,
  ): Promise<Array<{ id: string; gen: number }>> {
    const rows = await tx.$queryRaw<Array<{ ancestor_id: string; gen: number }>>(Prisma.sql`
      WITH RECURSIVE chain AS (
        SELECT id, "referrerId", 1 AS gen
          FROM "User"
         WHERE id = ${userId}
        UNION ALL
        SELECT u.id, u."referrerId", c.gen + 1
          FROM "User" u
          JOIN chain c ON u.id = c."referrerId"
         WHERE c.gen < 4
      )
      SELECT "referrerId" AS ancestor_id, gen
        FROM chain
       WHERE "referrerId" IS NOT NULL
         AND gen BETWEEN 1 AND 3
       ORDER BY gen
    `)
    return rows.map((r) => ({ id: r.ancestor_id, gen: r.gen }))
  }

  /**
   * Distribute referral earnings for a paid order.
   * - Must run inside the same transaction as Order.status → PAID/CONFIRMED.
   * - 3 generations: 3% / 5% / 17%, floor(amount * bps / 10000).
   * - Skip (platform 귀속, T8) any generation where:
   *     • no ancestor exists, OR
   *     • beneficiary.status != ACTIVE, OR
   *     • beneficiary.role is STAFF/STAFF_FAMILY (T6), OR
   *     • beneficiary.payoutEligibility = false (MINOR_HOLD etc., T7 → still records EARN but marked WITHHELD via status; see below).
   *
   * Idempotency: UNIQUE(orderId, beneficiaryUserId, generation, type). Re-calling
   * distribute for the same order is a no-op for conflicting rows.
   */
  async distribute(tx: Prisma.TransactionClient, orderId: string) {
    const order = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { user: true },
    })

    // (T6) 임직원 구매자는 레퍼럴 발생 대상에서 제외 — 상위는 수익 없음
    if (order.user.role === UserRole.STAFF || order.user.role === UserRole.STAFF_FAMILY) {
      this.logger.warn(`Skip referral distribute: buyer is STAFF. orderId=${orderId}`)
      return { created: 0, skipped: 3 }
    }

    const ancestors = await this.getAncestors(tx, order.userId)
    let created = 0
    let skipped = 0

    for (const rule of GENERATIONS) {
      const anc = ancestors.find((a) => a.gen === rule.gen)
      if (!anc) {
        skipped++
        this.logger.log(`gen=${rule.gen} 결손 → 플랫폼 귀속 (order=${orderId})`)
        continue
      }
      const beneficiary = await tx.user.findUniqueOrThrow({ where: { id: anc.id } })

      // (T6) STAFF 가드
      if (
        beneficiary.role === UserRole.STAFF ||
        beneficiary.role === UserRole.STAFF_FAMILY
      ) {
        skipped++
        continue
      }
      if (
        beneficiary.status === UserStatus.BANNED ||
        beneficiary.status === UserStatus.WITHDRAWN
      ) {
        skipped++
        continue
      }

      const amount = floorBps(order.totalAmountKrw, rule.bps)
      if (amount <= 0n) {
        skipped++
        continue
      }

      // (T7) MINOR_HOLD / suspended / payoutEligibility=false → ledger 는 남기되 상태를 분리
      const status: LedgerStatus =
        beneficiary.status === UserStatus.ACTIVE && beneficiary.payoutEligibility
          ? LedgerStatus.PENDING
          : LedgerStatus.SUSPENDED_FOR_REVIEW

      try {
        await tx.referralLedger.create({
          data: {
            orderId,
            beneficiaryUserId: beneficiary.id,
            generation: rule.gen,
            rateBps: rule.bps,
            amountKrw: amount,
            type: LedgerType.EARN,
            status,
          },
        })
        created++
      } catch (e: any) {
        // Idempotent: unique violation → already distributed for this slot
        if (e?.code === 'P2002') continue
        throw e
      }
    }

    return { created, skipped }
  }

  /**
   * Revert referral earnings for a refund.
   * - ratioBps: 10000 = 100%, 5000 = 50%.
   * - T2 정책: 구매확정 후 유보기간(기본 7일) 경과 후 환불 시 `lateRefund=true` 이면
   *   역정산 생략 (호출자 측에서 이 플래그 판단).
   * - 멱등성: 동일 (orderId, beneficiary, generation, REVERT) 이미 있으면 skip.
   */
  async revert(
    tx: Prisma.TransactionClient,
    orderId: string,
    ratioBps = 10_000,
    lateRefund = false,
  ) {
    if (lateRefund) {
      this.logger.warn(`late refund → skip revert ledger (order=${orderId})`)
      return { reverted: 0, skipped: 0, lateRefund: true }
    }

    const earns = await tx.referralLedger.findMany({
      where: { orderId, type: LedgerType.EARN },
    })
    let reverted = 0
    let skipped = 0
    for (const e of earns) {
      const revertAmount = floorBps(e.amountKrw, ratioBps)
      if (revertAmount <= 0n) {
        skipped++
        continue
      }
      try {
        await tx.referralLedger.create({
          data: {
            orderId,
            beneficiaryUserId: e.beneficiaryUserId,
            generation: e.generation,
            rateBps: e.rateBps,
            amountKrw: -revertAmount,
            type: LedgerType.REVERT,
            status: LedgerStatus.CONFIRMED,
            reason: ratioBps === 10_000 ? 'FULL_REFUND' : `PARTIAL_REFUND:${ratioBps}bps`,
          },
        })
        reverted++
      } catch (err: any) {
        if (err?.code === 'P2002') {
          skipped++
          continue
        }
        throw err
      }
    }
    return { reverted, skipped, lateRefund: false }
  }
}
