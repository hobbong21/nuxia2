import { z } from 'zod';
import { BigIntStringSchema, IsoDateTimeSchema } from './common';

export const ProductStatusSchema = z.enum([
  'DRAFT',
  'ACTIVE',
  'SOLD_OUT',
  'HIDDEN',
  'ARCHIVED',
]);
export type ProductStatus = z.infer<typeof ProductStatusSchema>;

export const ProductImageSchema = z.object({
  url: z.string().url(),
  alt: z.string().default(''),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});
export type ProductImage = z.infer<typeof ProductImageSchema>;

export const ProductSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().min(1),
  name: z.string().min(1),
  brandName: z.string().nullable(),
  categoryId: z.string().uuid().nullable(),
  status: ProductStatusSchema,
  /** 정가 (KRW, BigIntString) */
  listPriceKrw: BigIntStringSchema,
  /** 할인 후 판매가 (KRW, BigIntString) */
  salePriceKrw: BigIntStringSchema,
  /** 0~100 정수 할인율. listPrice와 salePrice로 계산 가능하지만 캐시 컬럼 */
  discountPct: z.number().int().min(0).max(100),
  /** 재고 (null이면 비관리 상품) */
  stock: z.number().int().min(0).nullable(),
  images: z.array(ProductImageSchema).min(1),
  description: z.string().default(''),
  /** 레퍼럴 적립률 프리뷰용 (bps. 300 = 3%) */
  referralPreviewBps: z.number().int().min(0).max(10000).default(300),
  avgRating: z.number().min(0).max(5).default(0),
  reviewCount: z.number().int().min(0).default(0),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type Product = z.infer<typeof ProductSchema>;

export const ProductListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  categoryId: z.string().uuid().optional(),
  keyword: z.string().optional(),
  sort: z.enum(['popular', 'newest', 'priceAsc', 'priceDesc']).default('popular'),
});
export type ProductListQuery = z.infer<typeof ProductListQuerySchema>;
