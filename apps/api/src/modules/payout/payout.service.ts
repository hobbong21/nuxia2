import { Injectable, Logger } from '@nestjs/common'
import { LedgerStatus, PayoutStatus, Prisma, UserStatus } from '@prisma/client'
import { PrismaService } from '../../common/prisma.module'
import { applyWithholding } from '../../common/util/money.util'

/**
 * Monthly payout runner.
 *
 * Calculates net payout per user for a given month:
 *   gross = Σ ReferralLedger.amountKrw (EARN + REVERT, same month, PENDING/CONFIRMED)
 *   tax   = floor(gross × withholdingBps / 10000)   // T1: default 3.3% = 330 bps
 *   net   = gross − tax
 *
 * Gating rules:
 *   - payoutEligibility === false (e.g. MINOR_HOLD, T7) → status=WITHHELD, do not auto-release.
 *   - user.status !== ACTIVE → WITHHELD
 *   - gross < MIN_PAYOUT_KRW → skip (carry over to next month).
 *
 * Idempotency: UNIQUE(userId, periodStart, periodEnd).
 */
@Injectable()
export class PayoutService {
  private readonly logger = new Logger('PayoutService')

  constructor(private readonly prisma: PrismaService) {}

  async runMonthly(periodStart: Date, periodEnd: Date) {
    const taxConfig = await this.getActiveTaxConfig()
    const withholdingBps =
      taxConfig?.withholdingBps ?? Number(process.env.WITHHOLDING_BPS ?? 330)
    const minPayout = BigInt(process.env.MIN_PAYOUT_KRW ?? 10_000)

    // All users with ledger activity in window
    const aggregates = await this.prisma.referralLedger.groupBy({
      by: ['beneficiaryUserId'],
      where: {
        createdAt: { gte: periodStart, lt: periodEnd },
        status: { in: [LedgerStatus.PENDING, LedgerStatus.CONFIRMED] },
      },
      _sum: { amountKrw: true },
    })

    const created: string[] = []
    for (const a of aggregates) {
      const gross = a._sum.amountKrw ?? 0n
      if (gross < minPayout) continue

      const user = await this.prisma.user.findUnique({ where: { id: a.beneficiaryUserId } })
      if (!user) continue

      const { tax, net } = applyWithholding(gross, withholdingBps)

      const status: PayoutStatus =
        !user.payoutEligibility || user.status !== UserStatus.ACTIVE
          ? PayoutStatus.WITHHELD
          : PayoutStatus.PENDING

      try {
        const payout = await this.prisma.payout.create({
          data: {
            userId: user.id,
            periodStart,
            periodEnd,
            amountGrossKrw: gross,
            amountTaxKrw: tax,
            amountNetKrw: net,
            taxConfigId: taxConfig?.id ?? null,
            status,
          },
        })
        created.push(payout.id)
      } catch (e: any) {
        if (e?.code === 'P2002') continue // already ran for this period
        throw e
      }
    }
    return { created: created.length, withholdingBps }
  }

  /**
   * Mark a WITHHELD payout as PAID. Admin-only caller.
   * Used by Admin console to release T7 MINOR_HOLD payouts after manual review.
   */
  async release(payoutId: string) {
    return this.prisma.payout.update({
      where: { id: payoutId },
      data: { status: PayoutStatus.PAID, processedAt: new Date() },
    })
  }

  private async getActiveTaxConfig() {
    return this.prisma.payoutTaxConfig.findFirst({
      where: { effectiveFrom: { lte: new Date() } },
      orderBy: { effectiveFrom: 'desc' },
    })
  }
}
