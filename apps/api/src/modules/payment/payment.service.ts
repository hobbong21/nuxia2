import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { OrderStatus, Prisma } from '@prisma/client'
import { PrismaService } from '../../common/prisma.module'
import { ReferralEngineService } from '../referral/engine.service'
import { PortOneClient } from './portone.client'

@Injectable()
export class PaymentService {
  private readonly logger = new Logger('PaymentService')

  constructor(
    private readonly prisma: PrismaService,
    private readonly portone: PortOneClient,
    private readonly referral: ReferralEngineService,
  ) {}

  /**
   * Confirm an order against PortOne.
   *
   * 5-step flow:
   *   1. Load order and assert PENDING_PAYMENT.
   *   2. Server-side PortOne re-fetch (never trust client-sent amount/status).
   *   3. Validate payment.status === 'PAID' AND amount === order.totalAmountKrw.
   *   4. In a Serializable transaction:
   *        a. Order.status = PAID + paymentId
   *        b. ReferralEngine.distribute(tx, orderId)  // 3세대 원장 생성
   *   5. Commit or rollback atomically.
   */
  async confirm(userId: string, orderId: string, paymentId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } })
    if (!order) throw new NotFoundException({ code: 'ORDER_NOT_FOUND', message: 'Order not found' })
    if (order.userId !== userId) {
      throw new NotFoundException({ code: 'ORDER_NOT_FOUND', message: 'Order not found' })
    }

    if (order.status === OrderStatus.PAID && order.paymentId === paymentId) {
      // Idempotent replay
      return { ok: true, idempotent: true }
    }
    if (order.status !== OrderStatus.PENDING_PAYMENT) {
      throw new ConflictException({
        code: 'ORDER_NOT_PENDING',
        message: `Order state invalid: ${order.status}`,
      })
    }

    // Step 2 & 3: server-side PortOne verification
    const payment = await this.portone.getPayment(paymentId)
    if (payment.status !== 'PAID') {
      throw new BadRequestException({
        code: 'PAYMENT_NOT_PAID',
        message: `PortOne status=${payment.status}`,
      })
    }
    const portoneTotal = BigInt(String(payment.amount.total))
    if (portoneTotal !== order.totalAmountKrw) {
      throw new ConflictException({
        code: 'AMOUNT_MISMATCH',
        message: `expected=${order.totalAmountKrw}, portone=${portoneTotal}`,
      })
    }

    // Step 4: Serializable transaction (status flip + referral.distribute)
    return this.prisma.$transaction(
      async (tx) => {
        const updated = await tx.order.update({
          where: { id: orderId },
          data: {
            status: OrderStatus.PAID,
            paymentId,
            paymentMethod: payment.payMethod,
          },
        })
        const dist = await this.referral.distribute(tx, updated.id)
        return { ok: true, order: updated, referral: dist }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    )
  }

  /**
   * Full refund — cancels payment at PortOne then writes REVERT ledger entries.
   * T2 정책: if `confirmedAt` is older than HOLD_DAYS → `lateRefund=true` → 역정산 생략.
   */
  async refundFull(orderId: string, reason: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } })
    if (!order || !order.paymentId) {
      throw new NotFoundException({ code: 'ORDER_NOT_FOUND', message: 'Order not found' })
    }

    const holdDays = Number(process.env.HOLD_DAYS ?? 7)
    const late =
      !!order.confirmedAt &&
      Date.now() - order.confirmedAt.getTime() > holdDays * 86_400_000

    await this.portone.cancelPayment(order.paymentId, { reason })

    return this.prisma.$transaction(
      async (tx) => {
        await tx.order.update({
          where: { id: orderId },
          data: {
            status: OrderStatus.REFUNDED,
            refundedAt: new Date(),
            refundedAmountKrw: order.totalAmountKrw,
          },
        })
        await tx.refund.create({
          data: {
            orderId,
            amountKrw: order.totalAmountKrw,
            reason,
            isPartial: false,
            ratioBps: 10_000,
            lateRefund: late,
            processedAt: new Date(),
          },
        })
        const result = await this.referral.revert(tx, orderId, 10_000, late)
        return { ok: true, lateRefund: late, ...result }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    )
  }

  /**
   * Partial refund by ratio (basis points). 5000 = 50%.
   */
  async refundPartial(orderId: string, ratioBps: number, reason: string) {
    if (ratioBps <= 0 || ratioBps >= 10_000) {
      throw new BadRequestException({ code: 'BAD_RATIO', message: 'ratioBps in (0, 10000)' })
    }
    const order = await this.prisma.order.findUnique({ where: { id: orderId } })
    if (!order || !order.paymentId) {
      throw new NotFoundException({ code: 'ORDER_NOT_FOUND', message: 'Order not found' })
    }

    const amount = (order.totalAmountKrw * BigInt(ratioBps)) / 10_000n

    const holdDays = Number(process.env.HOLD_DAYS ?? 7)
    const late =
      !!order.confirmedAt &&
      Date.now() - order.confirmedAt.getTime() > holdDays * 86_400_000

    await this.portone.cancelPayment(order.paymentId, { reason, amount })

    return this.prisma.$transaction(
      async (tx) => {
        await tx.order.update({
          where: { id: orderId },
          data: {
            status: OrderStatus.PARTIAL_REFUNDED,
            refundedAmountKrw: { increment: amount },
          },
        })
        await tx.refund.create({
          data: {
            orderId,
            amountKrw: amount,
            reason,
            isPartial: true,
            ratioBps,
            lateRefund: late,
            processedAt: new Date(),
          },
        })
        const result = await this.referral.revert(tx, orderId, ratioBps, late)
        return { ok: true, lateRefund: late, ...result }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    )
  }

  async syncStatus(paymentId: string) {
    const payment = await this.portone.getPayment(paymentId)
    return payment
  }
}
