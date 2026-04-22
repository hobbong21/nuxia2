/**
 * Auth API client — v0.4 M5-FE / S2.
 *
 * 담당:
 *  - 로그인 1단계 (email/password) → `{ needsTotp, userId }` 또는 accessToken
 *  - 로그인 2단계 (TOTP 코드) → accessToken 발급
 *  - 2FA setup / verify / disable (마이페이지)
 *
 * BE 스펙(10_v0.4.0_sprint.md §M5):
 *   POST /auth/login               → { needsTotp, userId } | AuthResponse
 *   POST /auth/2fa/login           → AuthResponse
 *   POST /auth/2fa/setup           → { otpauthUrl, qrDataUri, secret }
 *   POST /auth/2fa/verify          → { ok, enabledAt }
 *   POST /auth/2fa/disable         → { ok }
 *
 * v0.4 동기화: BE가 shared-types에 TotpSetupResponseSchema, TotpVerifyRequestSchema,
 * LoginStepOneResponseSchema, TotpLoginRequestSchema를 published. 아래 로컬 스키마는
 * FE 관심사만 취한 subset(예: otpauthUrl 미사용)이라 의도적으로 유지.
 */
import { z } from 'zod';
import { AuthResponseSchema } from '@nuxia2/shared-types';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'https://api.nuxia2.kr';

// ---------- 로컬 스키마 (BE 완료 후 shared-types import로 교체) ----------

export const LoginStep1ResponseSchema = z.union([
  // 2FA 가 꺼져있는 경우: 바로 토큰 발급
  AuthResponseSchema,
  // 2FA 가 켜져있는 경우: userId 만 반환 (비밀번호 검증 통과)
  z.object({
    needsTotp: z.literal(true),
    userId: z.string(),
  }),
]);
export type LoginStep1Response = z.infer<typeof LoginStep1ResponseSchema>;

export const TotpSetupResponseSchema = z.object({
  /** 'data:image/png;base64,...' QR */
  qrDataUri: z.string(),
  /** 백엔드가 화면에 fallback 표시용 텍스트 (Base32 TOTP 시크릿). 없으면 QR만 사용. */
  secret: z.string().optional(),
});
export type TotpSetupResponse = z.infer<typeof TotpSetupResponseSchema>;

export const TotpVerifyResponseSchema = z.object({
  ok: z.literal(true),
  enabledAt: z.string(),
});
export type TotpVerifyResponse = z.infer<typeof TotpVerifyResponseSchema>;

// ---------- v0.5 M3-FE: OTP backup 채널 ----------
export const OtpChannelSchema = z.enum(['SMS', 'EMAIL']);
export type OtpChannel = z.infer<typeof OtpChannelSchema>;

export const OtpRequestResponseSchema = z.object({
  ok: z.literal(true),
  /** 전송 TTL (초). BE 기본 180 (3분) */
  expiresInSec: z.number().int().positive().optional(),
});
export type OtpRequestResponse = z.infer<typeof OtpRequestResponseSchema>;

/** 로그인 2단계 OTP 검증 요청에 userId가 필요한 경우를 위한 request 형태 */
export const OtpLoginVerifyRequestSchema = z.object({
  userId: z.string(),
  kind: OtpChannelSchema,
  code: z.string().regex(/^\d{6}$/),
});
export type OtpLoginVerifyRequest = z.infer<typeof OtpLoginVerifyRequestSchema>;

// ---------- 공용 fetch ----------

async function authFetch<T>(
  path: string,
  body: unknown,
  schema: z.ZodType<T>,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  const text = await res.text();
  const json = text ? safeJson(text) : null;
  if (!res.ok) {
    const msg =
      (json && typeof json === 'object' && 'message' in json && String((json as Record<string, unknown>).message)) ||
      `HTTP ${res.status}`;
    throw new AuthClientError(String(msg), res.status);
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new AuthClientError('응답 형식이 올바르지 않습니다.', 500);
  }
  return parsed.data;
}

function safeJson(text: string): unknown {
  try { return JSON.parse(text); } catch { return text; }
}

export class AuthClientError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// ---------- API ----------

export const authApi = {
  /** 1단계: email/password */
  async login(email: string, password: string): Promise<LoginStep1Response> {
    return authFetch('/auth/login', { email, password }, LoginStep1ResponseSchema);
  },

  /** 2단계: TOTP 코드 제출 (userId는 1단계 응답에서 획득) */
  async login2FA(userId: string, code: string) {
    return authFetch('/auth/2fa/login', { userId, code }, AuthResponseSchema);
  },

  /** 2FA setup 시작: QR 반환 */
  async setup2FA() {
    return authFetch('/auth/2fa/setup', {}, TotpSetupResponseSchema);
  },

  /** 2FA setup 완료: 코드 검증 → totpEnabled=true */
  async verify2FA(code: string) {
    return authFetch('/auth/2fa/verify', { code }, TotpVerifyResponseSchema);
  },

  /** 2FA 비활성화 (현재 코드 요구) */
  async disable2FA(code: string) {
    return authFetch('/auth/2fa/disable', { code }, z.object({ ok: z.literal(true) }));
  },

  // ---------- v0.5 M3-FE: OTP 백업 ----------

  /**
   * OTP 코드 요청 (로그인 2단계 또는 마이페이지 테스트 발송).
   *  - 로그인 대체 경로: credentials 세션 + userId(서버가 쿠키로 식별)로 요청
   *  - 마이페이지 테스트: 동일 엔드포인트, 본인 userId (세션 기반)
   */
  async requestOtp(kind: OtpChannel, opts?: { userId?: string }): Promise<OtpRequestResponse> {
    return authFetch(
      '/auth/otp/request',
      { kind, ...(opts?.userId ? { userId: opts.userId } : {}) },
      OtpRequestResponseSchema,
    );
  },

  /**
   * OTP 코드 검증 → 2단계 로그인 완료. 성공 시 AuthResponse.
   */
  async verifyOtp(code: string, kind: OtpChannel, opts?: { userId?: string }) {
    return authFetch(
      '/auth/otp/verify',
      { code, kind, ...(opts?.userId ? { userId: opts.userId } : {}) },
      AuthResponseSchema,
    );
  },

  /** 현재 2FA 상태 조회 (마이페이지 진입 시) */
  async get2FAStatus(): Promise<{ enabled: boolean; enabledAt: string | null }> {
    const res = await fetch(`${API_BASE}/auth/2fa/status`, {
      credentials: 'include',
      cache: 'no-store',
    });
    if (!res.ok) return { enabled: false, enabledAt: null };
    const json = await res.json().catch(() => null);
    const parsed = z
      .object({ enabled: z.boolean(), enabledAt: z.string().nullable() })
      .safeParse(json);
    return parsed.success ? parsed.data : { enabled: false, enabledAt: null };
  },
};
