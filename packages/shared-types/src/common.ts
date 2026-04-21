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

/**
 * IdSchema — 백엔드 Prisma `@default(cuid())` 와 호환되는 리소스 식별자 스키마.
 * - cuid: 소문자 'c' 로 시작, 뒤에 24자 이상의 영숫자.
 * - 기존 `z.string().uuid()` 는 UUID v4 형식만 허용하여 cuid 값을 전부 거절했기에,
 *   서버/클라이언트 계약 전반에서 `IdSchema` 로 통일한다.
 * - 내부 상태용 랜덤 키(예: React list key)는 별도 UUID 로 써도 무방.
 */
export const IdSchema = z.string().regex(/^c[a-z0-9]{24,}$/, {
  message: 'Invalid cuid format',
});
export type Id = z.infer<typeof IdSchema>;
