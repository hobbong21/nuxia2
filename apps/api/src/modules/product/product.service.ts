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
  const rawImages = Array.isArray(p.images) ? p.images : []
  // shared-types `ProductSchema.images` 는 min(1) 요구. 실제 이미지가 없으면
  // placeholder URL 을 한 장 부여해 zod parse 실패를 회피한다.
  // 빈 문자열은 `z.string().url()` 검증에 실패하므로 반드시 유효 URL 이어야 한다.
  const images =
    rawImages.length > 0
      ? rawImages.map((url: string) => ({ url, alt: '' }))
      : [{ url: 'https://placehold.co/600x600?text=No+Image', alt: '' }]
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    brandName: p.brandName ?? null,
    // v2-P2-NEW-03: Prisma `Product.category` 는 자유 문자열(카테고리 이름).
    // shared-types 는 `categoryName` 으로 의미 일치 (categoryId 는 향후 Category 모델 도입 시 재도입).
    categoryName: (p.category ?? null) as string | null,
    status: p.status,
    listPriceKrw: bi(p.listPriceKrw ?? p.salePriceKrw ?? 0n),
    salePriceKrw: bi(p.salePriceKrw ?? 0n),
    discountPct: p.discountPct ?? 0,
    stock: p.stock ?? null,
    images,
    description: p.description ?? '',
    referralPreviewBps: p.referralPreviewBps ?? 2500,
    avgRating: p.avgRating ?? 0,
    reviewCount: p.reviewCount ?? 0,
    createdAt: iso(p.createdAt) ?? new Date().toISOString(),
    updatedAt: iso(p.updatedAt) ?? new Date().toISOString(),
  }
}
