import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.module'

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreate(userId: string) {
    let cart = await this.prisma.cart.findUnique({
      where: { userId },
      include: { items: { include: { product: true } } },
    })
    if (!cart) {
      cart = await this.prisma.cart.create({
        data: { userId },
        include: { items: { include: { product: true } } },
      })
    }
    return cart
  }

  async upsertItem(userId: string, productId: string, quantity: number) {
    const cart = await this.getOrCreate(userId)
    return this.prisma.cartItem.upsert({
      where: { cartId_productId: { cartId: cart.id, productId } },
      create: { cartId: cart.id, productId, quantity },
      update: { quantity },
    })
  }

  async removeItem(userId: string, productId: string) {
    const cart = await this.getOrCreate(userId)
    return this.prisma.cartItem.delete({
      where: { cartId_productId: { cartId: cart.id, productId } },
    })
  }

  async clear(userId: string) {
    const cart = await this.getOrCreate(userId)
    await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } })
    return { ok: true }
  }
}
