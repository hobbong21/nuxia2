import { z } from 'zod';

/**
 * BigIntString — JSON으로 안전하게 직렬화되는 금액 타입.
 * Prisma BigInt 컬럼을 JSON으로 내려받을 때 문자열로 변환되며,
 * FE에서는 표시·연산 시 문자열 → 숫자/비교 함수로만 사용.
 * 절대 JS Number로 캐스팅 금지 (KRW 수조 단위에서 정밀도 손실 방지용 규약).
 */
export const BigIntStringSchema = z
  .string()
  .regex(/^-?\d+$/, 'BigIntString must be a decimal integer string');

export type BigIntString = z.infer<typeof BigIntStringSchema>;

/** ISO 8601 UTC timestamp string */
export const IsoDateTimeSchema = z.string().datetime({ offset: true });
export type IsoDateTime = z.infer<typeof IsoDateTimeSchema>;

/** Paging request */
export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

/** 표준 API 에러 응답 */
export const ApiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

/** 표준 리스트 응답 래퍼 */
export const makePaginatedSchema = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    items: z.array(item),
    total: z.number().int().nonnegative(),
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1),
  });
