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
import { bi } from '../../common/util/serialize.util'

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
   * QA P1-02: PortOne amount.total 파싱 방어 (숫자/문자열/소수/비유효 처리)
   * QA P0-08: Order status 스펠링 CANCELLED (double L)
   * 응답: shared-types `PaymentConfirmResponseSchema` 와 매칭
   *       ({ orderId, status, amountPaidKrw, message })
   */
  async confirm(userId: string, orderId: string, paymentId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } })
    if (!order) throw new NotFoundException({ code: 'ORDER_NOT_FOUND', message: 'Order not found' })
    if (order.userId !== userId) {
      throw new NotFoundException({ code: 'ORDER_NOT_FOUND', message: 'Order not found' })
    }

    // v0.2-N3: Idempotent replay — 이미 PAID 이고 paymentId 가 일치하면
    // 레퍼럴 재분배 없이 기존 상태만 반환.
    if (order.status === OrderStatus.PAID && order.paymentId === paymentId) {
      return this.buildConfirmResponse(order, 'idempotent replay', true)
    }
    // v0.2-N3: PAID 인데 paymentId 가 다르면 명확한 409 로 거절 (금액 재검증도 불가).
    if (order.status === OrderStatus.PAID && order.paymentId !== paymentId) {
      throw new ConflictException({
        code: 'PAYMENT_ID_MISMATCH',
        message: `Order already paid with different paymentId (order=${order.paymentId}, body=${paymentId})`,
      })
    }
    if (order.status !== OrderStatus.PENDING_PAYMENT) {
      throw new ConflictException({
        code: 'ORDER_NOT_PENDING',
        message: `Order state invalid: ${order.status}`,
      })
    }

    // P0-07: paymentId가 미리 배정돼 있으므로 일치 확인
    if (order.paymentId && order.paymentId !== paymentId) {
      throw new BadRequestException({
        code: 'PAYMENT_ID_MISMATCH',
        message: `order.paymentId=${order.paymentId}, body=${paymentId}`,
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

    // P1-02: 안전한 amount 파싱 (숫자 OR decimal-integer string 만 허용)
    const portoneTotal = parsePortOneTotal(payment.amount?.total)
    if (portoneTotal !== order.totalAmountKrw) {
      throw new ConflictException({
        code: 'AMOUNT_MISMATCH',
        message: `expected=${order.totalAmountKrw}, portone=${portoneTotal}`,
      })
    }

    // Step 4: Serializable transaction (status flip + referral.distribute)
    const updated = await this.prisma.$transaction(
      async (tx) => {
        const u = await tx.order.update({
          where: { id: orderId },
          data: {
            status: OrderStatus.PAID,
            paymentId,
            paymentMethod: payment.payMethod,
          },
        })
        await this.referral.distribute(tx, u.id)
        return u
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    )

    return this.buildConfirmResponse(updated, 'payment confirmed')
  }

  private buildConfirmResponse(order: any, message: string, alreadyPaid = false) {
    // shared-types PaymentConfirmResponseSchema 와 매칭 (v0.2-N3: alreadyPaid 추가)
    const statusMap: Record<string, 'PAID' | 'PENDING_PAYMENT' | 'CANCELLED' | 'FAILED'> = {
      PAID: 'PAID',
      PENDING_PAYMENT: 'PENDING_PAYMENT',
      CANCELLED: 'CANCELLED',
    }
    const status = statusMap[order.status] ?? 'FAILED'
    return {
      orderId: order.id,
      status,
      amountPaidKrw: bi(order.totalAmountKrw),
      message,
      ...(alreadyPaid ? { alreadyPaid: true } : {}),
    }
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

/**
 * QA P1-02: PortOne `amount.total` 은 `number | string` 두 가지 형태로 들어올 수
 * 있다. 다음 규칙으로 안전하게 bigint 로 변환:
 *
 *  - number: Number.isFinite(x) && Number.isInteger(x) 여야 함 (소수·NaN 거부)
 *  - string: /^-?\d+$/ 매칭 (decimal integer 만)
 *  - 그 외: BadRequestException
 */
export function parsePortOneTotal(v: unknown): bigint {
  if (typeof v === 'number') {
    if (!Number.isFinite(v) || !Number.isInteger(v)) {
      throw new BadRequestException({
        code: 'AMOUNT_INVALID',
        message: `PortOne amount.total is not a finite integer: ${v}`,
      })
    }
    return BigInt(v)
  }
  if (typeof v === 'string') {
    if (!/^-?\d+$/.test(v)) {
      throw new BadRequestException({
        code: 'AMOUNT_INVALID',
        message: `PortOne amount.total string must be a decimal integer: ${v}`,
      })
    }
    return BigInt(v)
  }
  throw new BadRequestException({
    code: 'AMOUNT_INVALID',
    message: `PortOne amount.total has unexpected type: ${typeof v}`,
  })
}
