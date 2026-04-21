import { Injectable } from '@nestjs/common'
import { AbuseKind, UserRole, UserStatus } from '@prisma/client'
import { PrismaService } from '../../common/prisma.module'
import { PayoutService } from '../payout/payout.service'

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payouts: PayoutService,
  ) {}

  async listAbuseLogs(params: { kind?: AbuseKind; from?: Date; to?: Date; limit?: number }) {
    return this.prisma.abuseLog.findMany({
      where: {
        ...(params.kind ? { kind: params.kind } : {}),
        ...(params.from || params.to
          ? { detectedAt: { gte: params.from, lte: params.to } }
          : {}),
      },
      take: Math.min(params.limit ?? 100, 500),
      orderBy: { detectedAt: 'desc' },
    })
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

  /** T7: Release MINOR_HOLD → set ACTIVE + payoutEligibility=true. Manual only. */
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
