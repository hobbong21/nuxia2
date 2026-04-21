import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { OrderStatus, Prisma } from '@prisma/client'
import { PrismaService } from '../../common/prisma.module'

export interface CreateOrderItem {
  productId: string
  quantity: number
}

export interface CreateOrderInput {
  userId: string
  items: CreateOrderItem[]
  pointUsedKrw?: bigint
  discountKrw?: bigint
  shippingAddress?: unknown
}

@Injectable()
export class OrderService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a PENDING_PAYMENT order. Snapshots prices, validates stock.
   * Referral base (T3/T4): `totalAmountKrw` = 상품 소계 - 할인 (쿠폰 차감 후)
   *                         + shipping. 포인트는 현금성(T4)이므로 reportable 금액에 포함하지 않고
   *                         `pointUsedKrw`는 참고용으로만 저장.
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
        throw new BadRequestException({ code: 'OUT_OF_STOCK', message: `Out of stock: ${p.sku}` })
      }
      subtotal += p.priceKrw * BigInt(it.quantity)
    }
    const discount = input.discountKrw ?? 0n
    const total = subtotal - discount
    if (total < 0n) {
      throw new BadRequestException({ code: 'DISCOUNT_TOO_LARGE', message: 'Negative total' })
    }

    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          userId: input.userId,
          totalAmountKrw: total,
          pointUsedKrw: input.pointUsedKrw ?? 0n,
          discountKrw: discount,
          status: OrderStatus.PENDING_PAYMENT,
          shippingAddress: (input.shippingAddress as Prisma.InputJsonValue) ?? undefined,
          items: {
            create: input.items.map((it) => {
              const p = products.find((x) => x.id === it.productId)!
              return {
                productId: p.id,
                productNameSnapshot: p.name,
                unitPriceKrw: p.priceKrw,
                quantity: it.quantity,
              }
            }),
          },
        },
        include: { items: true },
      })
      // (Stock reservation would normally happen here — left to a separate
      //  inventory module for MVP. TODO when inventory service is added.)
      return order
    })
  }

  async getById(userId: string, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    })
    if (!order || order.userId !== userId) {
      throw new NotFoundException({ code: 'ORDER_NOT_FOUND', message: 'Order not found' })
    }
    return order
  }

  async listMine(userId: string) {
    return this.prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { items: true },
    })
  }

  async confirmReceipt(userId: string, orderId: string) {
    const order = await this.getById(userId, orderId)
    if (order.status !== OrderStatus.DELIVERED) {
      throw new BadRequestException({ code: 'INVALID_STATE', message: 'Cannot confirm' })
    }
    return this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'CONFIRMED', confirmedAt: new Date() },
    })
  }
}
