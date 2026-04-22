/**
 * Admin 전용 zod 스키마 — v0.4.0 M1.
 *
 * FE `admin-client.ts` 의 8 메서드에 1:1 매핑되는 응답 계약.
 * 민감 필드(ci 평문, passwordHash, 내부 ancestorPath)는 BE 가 mask/strip 후 반환.
 */
import { z } from 'zod';
import { BigIntStringSchema, IdSchema, IsoDateTimeSchema } from './common';
import { UserRoleSchema, UserStatusSchema } from './user';
import { PayoutSchema } from './referral';

/** GET /admin/kpi */
export const AdminKpiSchema = z.object({
  /** 이번 달 AbuseLog 건수 (KST 월 경계) */
  blockedThisMonth: z.number().int().nonnegative(),
  /** status=PENDING + WITHHELD Payout 의 amountNetKrw 합계 */
  pendingPayoutKrw: BigIntStringSchema,
  /** status=MINOR_HOLD User 카운트 (T7) */
  minorHoldCount: z.number().int().nonnegative(),
  /** role=CUSTOMER + status=ACTIVE 카운트 */
  activeUserCount: z.number().int().nonnegative(),
});
export type AdminKpi = z.infer<typeof AdminKpiSchema>;

/** GET /admin/users/:id 및 /admin/users 의 단위 아이템 */
export const AdminUserSchema = z.object({
  id: IdSchema,
  email: z.string().email(),
  nickname: z.string(),
  role: UserRoleSchema,
  status: UserStatusSchema,
  /** 해시 1자 + x... (예: "hxxxxxxx"). 평문 ci 노출 금지. */
  ciMasked: z.string(),
  identityVerified: z.boolean(),
  payoutEligibility: z.boolean(),
  /** 해당 유저 관련 AbuseLog 건수 (primaryUserId 매치) */
  flaggedCount: z.number().int().nonnegative(),
  createdAt: IsoDateTimeSchema,
  lastLoginAt: IsoDateTimeSchema.nullable(),
  withdrawnAt: IsoDateTimeSchema.nullable(),
});
export type AdminUser = z.infer<typeof AdminUserSchema>;

/** GET /admin/users 응답 */
export const PaginatedAdminUsersSchema = z.object({
  items: z.array(AdminUserSchema),
  nextCursor: IdSchema.nullable(),
});
export type PaginatedAdminUsers = z.infer<typeof PaginatedAdminUsersSchema>;

/** GET /admin/payouts 응답 */
export const PaginatedPayoutsSchema = z.object({
  items: z.array(PayoutSchema),
  nextCursor: IdSchema.nullable(),
});
export type PaginatedPayouts = z.infer<typeof PaginatedPayoutsSchema>;

// ---------------------------------------------------------------------------
// M5 — 2FA (TOTP)
// ---------------------------------------------------------------------------

/** POST /auth/2fa/setup 응답 — QR 데이터 URI + otpauth URL + raw secret(1회만) */
export const TotpSetupResponseSchema = z.object({
  /** otpauth://totp/... URI */
  otpauthUrl: z.string(),
  /** data:image/png;base64,... QR 데이터 URI */
  qrDataUri: z.string(),
  /** base32 secret. 사용자는 이 시점에만 복사 가능 (백엔드는 암호화 저장). */
  secret: z.string(),
});
export type TotpSetupResponse = z.infer<typeof TotpSetupResponseSchema>;

/** POST /auth/2fa/verify · /disable · /login 요청 */
export const TotpVerifyRequestSchema = z.object({
  code: z.string().regex(/^\d{6}$/, 'TOTP code must be 6 digits'),
});
export type TotpVerifyRequest = z.infer<typeof TotpVerifyRequestSchema>;

/** 2FA 활성 계정 로그인 1단계 응답 */
export const LoginStepOneResponseSchema = z.object({
  needsTotp: z.literal(true),
  /** 2단계 login 호출 시 사용할 user id (세션 없이 전달) */
  userId: IdSchema,
});
export type LoginStepOneResponse = z.infer<typeof LoginStepOneResponseSchema>;

/** POST /auth/2fa/login 요청 */
export const TotpLoginRequestSchema = z.object({
  userId: IdSchema,
  code: z.string().regex(/^\d{6}$/),
});
export type TotpLoginRequest = z.infer<typeof TotpLoginRequestSchema>;

// ---------------------------------------------------------------------------
// M2 — AuditLog (v0.5)
// ---------------------------------------------------------------------------

/** 관리자 감사 로그 kind. audit.decorator의 @Audit 데코레이터와 일치. */
export const AuditLogKindSchema = z.enum([
  'USER_FLAG',
  'USER_RELEASE_MINOR',
  'USER_MARK_STAFF',
  'USER_SUSPEND',
  'PAYOUT_RUN',
  'PAYOUT_RELEASE',
]);
export type AuditLogKind = z.infer<typeof AuditLogKindSchema>;

/** GET /admin/audit-logs 단위 아이템 */
export const AuditLogSchema = z.object({
  id: IdSchema,
  actorUserId: IdSchema,
  /** 행위자 닉네임 (JOIN 조회 결과, 탈퇴 등으로 null 가능) */
  actorNickname: z.string().nullable(),
  kind: AuditLogKindSchema,
  targetType: z.string(),
  targetId: IdSchema,
  /** before/after key 비교 요약 (예: "status,payoutEligibility"). 변경 없으면 null */
  diffSummary: z.string().nullable(),
  createdAt: IsoDateTimeSchema,
});
export type AuditLog = z.infer<typeof AuditLogSchema>;

/** GET /admin/audit-logs 응답 */
export const PaginatedAuditLogsSchema = z.object({
  items: z.array(AuditLogSchema),
  nextCursor: IdSchema.nullable(),
});
export type PaginatedAuditLogs = z.infer<typeof PaginatedAuditLogsSchema>;

// ---------------------------------------------------------------------------
// M3 — OTP backup (v0.5)
// ---------------------------------------------------------------------------

/** OTP 채널 종류 */
export const OtpKindSchema = z.enum(['SMS', 'EMAIL']);
export type OtpKind = z.infer<typeof OtpKindSchema>;

/** POST /auth/otp/request */
export const OtpRequestSchema = z.object({
  kind: OtpKindSchema,
  /** 로그인 2단계 경로용(userId). 마이페이지에서는 세션 기반이므로 생략 가능 */
  userId: IdSchema.optional(),
});
export type OtpRequest = z.infer<typeof OtpRequestSchema>;

/** POST /auth/otp/verify */
export const OtpVerifySchema = z.object({
  kind: OtpKindSchema,
  code: z.string().regex(/^\d{6}$/),
  userId: IdSchema.optional(),
});
export type OtpVerify = z.infer<typeof OtpVerifySchema>;
