import { Injectable, NotFoundException } from '@nestjs/common'
import { ProductStatus } from '@prisma/client'
import { PrismaService } from '../../common/prisma.module'

export interface ListProductQuery {
  q?: string
  category?: string
  cursor?: string
  limit?: number
}

@Injectable()
export class ProductService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListProductQuery) {
    const limit = Math.min(query.limit ?? 20, 50)
    const items = await this.prisma.product.findMany({
      where: {
        status: { in: [ProductStatus.ON_SALE, ProductStatus.SOLD_OUT] },
        ...(query.q ? { name: { contains: query.q, mode: 'insensitive' } } : {}),
        ...(query.category ? { category: query.category } : {}),
      },
      take: limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
    })
    const nextCursor = items.length > limit ? items.pop()!.id : null
    return { items, nextCursor }
  }

  async getById(id: string) {
    const p = await this.prisma.product.findUnique({ where: { id } })
    if (!p) throw new NotFoundException({ code: 'PRODUCT_NOT_FOUND', message: 'Product not found' })
    return p
  }
}
