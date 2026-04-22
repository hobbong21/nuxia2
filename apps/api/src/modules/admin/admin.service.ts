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

  /**
   * v0.2 S2 — 루트 유저 기준 3-depth 트리. 3세대 레퍼럴 범위와 일치.
   */
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

    // 트리 구성
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

  /** v0.2 S2 — 어뷰징 심사 전환 */
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
