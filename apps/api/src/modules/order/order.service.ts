import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { OrderStatus, Prisma } from '@prisma/client'
import { PrismaService } from '../../common/prisma.module'
import { bi, iso } from '../../common/util/serialize.util'

export interface CreateOrderItem {
  productId: string
  quantity: number
  optionSummary?: string
}

export interface CreateOrderInput {
  userId: string
  items: CreateOrderItem[]
  pointUsedKrw?: bigint
  couponDiscountKrw?: bigint
  shippingFeeKrw?: bigint
  shippingAddress?: unknown
}

@Injectable()
export class OrderService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a PENDING_PAYMENT order. Snapshots prices, validates stock.
   * Referral base (T3/T4): `totalAmountKrw` = 상품 소계 - 쿠폰 차감 + 배송비.
   * 포인트는 현금성(T4)이라 `totalAmountKrw` 에서 빼지 않고, 표시용 `pointUsedKrw` 저장.
   *
   * QA P0-07: 응답에 `paymentId` 포함 (= "payment_<orderId>"). BE가 결정론적으로 생성하여
   * 동일 값을 `Order.paymentId` 에 저장. FE 는 이 값을 포트원 requestPayment 에 그대로 전달.
   */
  async create(input: CreateOrderInput) {
    if (!input.items.length) {
      throw new BadRequestException({ code: 'EMPTY_CART', message: 'No items' })
    }

    const products = await this.prisma.product.findMany({
      where: { id: { in: input.items.map((i) => i.productId) } },
    })
    if (products.length !== input.items.length) {
      throw new BadRequestException({ code: 'PRODUCT_NOT_FOUND', message: 'Invalid product ids' })
    }

    let subtotal = 0n
    for (const it of input.items) {
      const p = products.find((x) => x.id === it.productId)!
      if (p.stock < it.quantity) {
        throw new BadRequestException({ code: 'OUT_OF_STOCK', message: `Out of stock: ${p.slug}` })
      }
      subtotal += (p as any).salePriceKrw * BigInt(it.quantity)
    }
    const coupon = input.couponDiscountKrw ?? 0n
    const shippingFee = input.shippingFeeKrw ?? 0n
    const total = subtotal - coupon + shippingFee
    if (total < 0n) {
      throw new BadRequestException({ code: 'DISCOUNT_TOO_LARGE', message: 'Negative total' })
    }

    const order = await this.prisma.$transaction(async (tx) => {
      const o = await tx.order.create({
        data: {
          userId: input.userId,
          totalAmountKrw: total,
          subtotalAmountKrw: subtotal,
          couponDiscountKrw: coupon,
          discountKrw: coupon, // legacy 필드 호환
          pointUsedKrw: input.pointUsedKrw ?? 0n,
          shippingFeeKrw: shippingFee,
          status: OrderStatus.PENDING_PAYMENT,
          shippingAddress: (input.shippingAddress as Prisma.InputJsonValue) ?? undefined,
          items: {
            create: input.items.map((it) => {
              const p = products.find((x) => x.id === it.productId)!
              const unit = (p as any).salePriceKrw as bigint
              const line = unit * BigInt(it.quantity)
              return {
                productId: p.id,
                productNameSnapshot: p.name,
                imageUrlSnapshot: Array.isArray((p as any).images) ? (p as any).images[0] ?? null : null,
                optionSummary: it.optionSummary ?? null,
                unitPriceKrw: unit,
                quantity: it.quantity,
                lineAmountKrw: line,
              }
            }),
          },
        },
        include: { items: true },
      })
      // P0-07: paymentId 결정론적 부여. Order.paymentId UNIQUE 제약을 유지하기 위해
      // 생성 직후 채우고 같은 트랜잭션에 commit.
      const paymentId = `payment_${o.id}`
      const updated = await tx.order.update({
        where: { id: o.id },
        data: { paymentId },
        include: { items: true },
      })
      return updated
    })

    // QA P0-07 / shared-types CreateOrderResponseSchema 와 매칭
    return {
      orderId: order.id,
      totalAmountKrw: bi(order.totalAmountKrw),
      paymentId: order.paymentId as string,
    }
  }

  async getById(userId: string, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    })
    if (!order || order.userId !== userId) {
      throw new NotFoundException({ code: 'ORDER_NOT_FOUND', message: 'Order not found' })
    }
    return serializeOrder(order)
  }

  async listMine(userId: string) {
    const rows = await this.prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { items: true },
    })
    return rows.map(serializeOrder)
  }

  async confirmReceipt(userId: string, orderId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } })
    if (!order || order.userId !== userId) {
      throw new NotFoundException({ code: 'ORDER_NOT_FOUND', message: 'Order not found' })
    }
    if (order.status !== OrderStatus.DELIVERED) {
      throw new BadRequestException({ code: 'INVALID_STATE', message: 'Cannot confirm' })
    }
    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'CONFIRMED', confirmedAt: new Date() },
      include: { items: true },
    })
    return serializeOrder(updated)
  }
}

/** Prisma Order row → shared-types Order DTO (BigInt→string, Date→ISO) */
export function serializeOrder(o: any) {
  return {
    id: o.id,
    userId: o.userId,
    totalAmountKrw: bi(o.totalAmountKrw),
    subtotalAmountKrw: bi(o.subtotalAmountKrw ?? 0n),
    couponDiscountKrw: bi(o.couponDiscountKrw ?? o.discountKrw ?? 0n),
    pointUsedKrw: bi(o.pointUsedKrw ?? 0n),
    shippingFeeKrw: bi(o.shippingFeeKrw ?? 0n),
    status: o.status,
    paymentId: o.paymentId ?? null,
    shippingAddress: o.shippingAddress ?? null,
    items: (o.items ?? []).map((it: any) => ({
      id: it.id,
      orderId: it.orderId,
      productId: it.productId,
      productNameSnapshot: it.productNameSnapshot,
      imageUrlSnapshot: it.imageUrlSnapshot ?? null,
      unitPriceKrw: bi(it.unitPriceKrw),
      quantity: it.quantity,
      lineAmountKrw: bi(it.lineAmountKrw ?? it.unitPriceKrw * BigInt(it.quantity)),
      refundedQuantity: it.refundedQuantity ?? 0,
      optionSummary: it.optionSummary ?? null,
    })),
    confirmedAt: iso(o.confirmedAt),
    createdAt: iso(o.createdAt) ?? new Date().toISOString(),
    updatedAt: iso(o.updatedAt) ?? new Date().toISOString(),
  }
}
