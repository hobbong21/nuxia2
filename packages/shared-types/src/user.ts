import { z } from 'zod';
import { IdSchema, IsoDateTimeSchema } from './common';

/** 정책 01a T6 — 역할 enum (STAFF/STAFF_FAMILY는 레퍼럴 참여 불가) */
export const UserRoleSchema = z.enum([
  'CUSTOMER',
  'STAFF',
  'STAFF_FAMILY',
  'ADMIN',
]);
export type UserRole = z.infer<typeof UserRoleSchema>;

/** 정책 01a — 계정 상태 (WITHDRAWN: 쿨다운 30일) */
export const UserStatusSchema = z.enum([
  'ACTIVE',
  'SUSPENDED',
  'BANNED',
  'WITHDRAWN',
  'UNDER_REVIEW',
  'MINOR_HOLD',
]);
export type UserStatus = z.infer<typeof UserStatusSchema>;

export const UserSchema = z.object({
  id: IdSchema,
  email: z.string().email(),
  nickname: z.string().min(1).max(40),
  referralCode: z.string().min(4).max(16),
  referrerId: IdSchema.nullable(),
  ancestorPath: z.array(IdSchema).max(3),
  role: UserRoleSchema,
  status: UserStatusSchema,
  /** 본인인증 완료 여부 (ci 존재) */
  identityVerified: z.boolean(),
  /** 미성년자 등 수동 유보 해제 필요 */
  payoutEligibility: z.boolean(),
  /** 본인인증 시 파싱된 만 나이. 미인증은 null */
  age: z.number().int().min(0).max(150).nullable(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type User = z.infer<typeof UserSchema>;

export const SignupRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(72),
  nickname: z.string().min(1).max(40),
  /** 포트원 본인인증 결과 식별자 */
  identityVerificationId: z.string().min(1),
  /** 추천인 코드 (URL 쿼리 또는 딥링크로부터 주입) */
  referralCode: z.string().optional(),
});
export type SignupRequest = z.infer<typeof SignupRequestSchema>;

export const LoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const AuthResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  user: UserSchema,
});
export type AuthResponse = z.infer<typeof AuthResponseSchema>;

/**
 * v0.2 S1 — Refresh token rotation.
 *  - 프론트: accessToken 만료 시 refreshToken 으로 재발급.
 *  - 서버: Session row TTL 검증 + rotation (새 refreshToken 저장, 기존 row revoke).
 */
export const AuthRefreshRequestSchema = z.object({
  refreshToken: z.string().min(1),
});
export type AuthRefreshRequest = z.infer<typeof AuthRefreshRequestSchema>;

export const AuthRefreshResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
});
export type AuthRefreshResponse = z.infer<typeof AuthRefreshResponseSchema>;
