import { Injectable, NotFoundException } from '@nestjs/common'
import { ProductStatus } from '@prisma/client'
import { PrismaService } from '../../common/prisma.module'
import { bi, iso } from '../../common/util/serialize.util'

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
        // QA P1-05: enum 이행 — ON_SALE → ACTIVE
        status: { in: [ProductStatus.ACTIVE, ProductStatus.SOLD_OUT] },
        ...(query.q ? { name: { contains: query.q, mode: 'insensitive' } } : {}),
        ...(query.category ? { category: query.category } : {}),
      },
      take: limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
    })
    const nextCursor = items.length > limit ? items.pop()!.id : null
    return { items: items.map(serializeProduct), nextCursor }
  }

  async getById(id: string) {
    const p = await this.prisma.product.findUnique({ where: { id } })
    if (!p) throw new NotFoundException({ code: 'PRODUCT_NOT_FOUND', message: 'Product not found' })
    return serializeProduct(p)
  }
}

/** shared-types `ProductSchema` 와 일치하는 shape 으로 변환 */
export function serializeProduct(p: any) {
  const images = Array.isArray(p.images) ? p.images : []
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    brandName: p.brandName ?? null,
    categoryId: null as string | null,
    status: p.status,
    listPriceKrw: bi(p.listPriceKrw ?? p.salePriceKrw ?? 0n),
    salePriceKrw: bi(p.salePriceKrw ?? 0n),
    discountPct: p.discountPct ?? 0,
    stock: p.stock ?? null,
    images: images.length
      ? images.map((url: string) => ({ url, alt: '' }))
      : [{ url: '', alt: '' }],
    description: p.description ?? '',
    referralPreviewBps: p.referralPreviewBps ?? 2500,
    avgRating: p.avgRating ?? 0,
    reviewCount: p.reviewCount ?? 0,
    createdAt: iso(p.createdAt) ?? new Date().toISOString(),
    updatedAt: iso(p.updatedAt) ?? new Date().toISOString(),
  }
}
