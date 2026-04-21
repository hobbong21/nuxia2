import { Injectable } from '@nestjs/common'
import { LedgerStatus, Prisma } from '@prisma/client'
import { PrismaService } from '../../common/prisma.module'

@Injectable()
export class ReferralDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(userId: string) {
    const [sum, pending, thisMonth] = await Promise.all([
      this.prisma.referralLedger.aggregate({
        where: { beneficiaryUserId: userId },
        _sum: { amountKrw: true },
      }),
      this.prisma.referralLedger.aggregate({
        where: { beneficiaryUserId: userId, status: LedgerStatus.PENDING },
        _sum: { amountKrw: true },
      }),
      this.prisma.referralLedger.aggregate({
        where: {
          beneficiaryUserId: userId,
          createdAt: { gte: startOfMonth(new Date()) },
        },
        _sum: { amountKrw: true },
      }),
    ])
    return {
      totalKrw: (sum._sum.amountKrw ?? 0n).toString(),
      pendingKrw: (pending._sum.amountKrw ?? 0n).toString(),
      thisMonthKrw: (thisMonth._sum.amountKrw ?? 0n).toString(),
    }
  }

  async getTree(userId: string) {
    // Return self + children 3 generations deep (for display)
    const rows = await this.prisma.$queryRaw<
      Array<{ id: string; nickname: string; referrer_id: string | null; depth: number }>
    >(Prisma.sql`
      WITH RECURSIVE subtree AS (
        SELECT id, nickname, "referrerId" AS referrer_id, 0 AS depth
          FROM "User" WHERE id = ${userId}
        UNION ALL
        SELECT u.id, u.nickname, u."referrerId", s.depth + 1
          FROM "User" u
          JOIN subtree s ON u."referrerId" = s.id
         WHERE s.depth < 3
      )
      SELECT id, nickname, referrer_id, depth FROM subtree ORDER BY depth ASC
    `)
    return { userId, nodes: rows }
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
    return { items, nextCursor }
  }
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}
