import {
  Body,
  Controller,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { AuthService } from './auth.service'
import { TotpService } from './totp.service'
import { OtpService } from './otp.service'
import { JwtAuthGuard } from '../../common/guards/auth.guard'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'

// v0.5 M3 — OTP 백업 (SMS/Email) 스키마
export const OtpKindSchema = z.enum(['SMS', 'EMAIL'])
export const OtpRequestSchema = z.object({
  kind: OtpKindSchema,
  userId: z.string().optional(),
})
export type OtpRequestDto = z.infer<typeof OtpRequestSchema>
export const OtpVerifySchema2 = z.object({
  kind: OtpKindSchema,
  code: z.string().regex(/^\d{6}$/),
  userId: z.string().optional(),
})
export type OtpVerifyDto2 = z.infer<typeof OtpVerifySchema2>

// QA P0-01: 프론트는 plaintext `ci` 대신 `identityVerificationId` 를 보낸다.
// 서버가 포트온 identity-verification API 로 재조회하여 ci/birth 를 획득.
// shared-types `SignupRequestSchema` 와 1:1 매칭.
export const SignupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(72),
  nickname: z.string().min(1).max(40),
  identityVerificationId: z.string().min(1),
  referralCode: z.string().optional(),
  deviceFingerprint: z.string().optional(),
})
export type SignupDto = z.infer<typeof SignupSchema>

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})
export type LoginDto = z.infer<typeof LoginSchema>

// v0.2 S1: shared-types `AuthRefreshRequestSchema` 와 동일 shape.
export const RefreshSchema = z.object({
  refreshToken: z.string().min(1),
})
export type RefreshDto = z.infer<typeof RefreshSchema>

export const TotpVerifySchema = z.object({
  code: z.string().regex(/^\d{6}$/, 'TOTP code must be 6 digits'),
})
export type TotpVerifyDto = z.infer<typeof TotpVerifySchema>

export const TotpLoginSchema = z.object({
  userId: z.string().min(1),
  code: z.string().regex(/^\d{6}$/),
})
export type TotpLoginDto = z.infer<typeof TotpLoginSchema>

/**
 * v0.4 M2 — 로그인 성공 + role=ADMIN 일 때 Set-Cookie 로 `nx_role=ADMIN` 발급.
 * HttpOnly + SameSite=Lax, prod 에서는 Secure.
 */
function setAdminRoleCookie(res: any, role: string) {
  if (!res?.setHeader) return
  if (role !== 'ADMIN') return
  const parts = [
    'nx_role=ADMIN',
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=3600',
  ]
  if (process.env.NODE_ENV === 'production') parts.push('Secure')
  res.setHeader('Set-Cookie', parts.join('; '))
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly totp: TotpService,
    private readonly otp: OtpService,
  ) {}

  // --- v0.5 M3: OTP 백업 (SMS/Email) ---

  /**
   * OTP 코드 요청.
   *  - 인증된 사용자: req.user.userId 사용
   *  - 로그인 2단계 경로: body.userId 허용 (1단계 응답의 userId)
   */
  @Post('otp/request')
  async otpRequest(
    @Body(new ZodValidationPipe(OtpRequestSchema)) body: OtpRequestDto,
    @Req() req: any,
  ) {
    const userId = req.user?.userId ?? body.userId
    if (!userId) {
      return { statusCode: 400, code: 'USER_ID_REQUIRED', message: 'userId 필수.' }
    }
    return this.otp.requestOtp(userId, body.kind)
  }

  /**
   * OTP 코드 검증. 성공 시 `{ ok: true }`.
   * (로그인 대체 흐름의 경우, 성공 후 클라이언트는 /auth/login 재호출하거나
   *  별도 `/auth/otp/login` 플로우로 확장 가능 — v0.5 범위는 검증만)
   */
  @Post('otp/verify')
  async otpVerify(
    @Body(new ZodValidationPipe(OtpVerifySchema2)) body: OtpVerifyDto2,
    @Req() req: any,
  ) {
    const userId = req.user?.userId ?? body.userId
    if (!userId) {
      return { statusCode: 400, code: 'USER_ID_REQUIRED', message: 'userId 필수.' }
    }
    return this.otp.verifyOtp(userId, body.kind, body.code)
  }

  @Post('signup')
  async signup(@Body(new ZodValidationPipe(SignupSchema)) body: SignupDto, @Req() req: any) {
    return this.auth.signup({ ...body, ip: req.ip })
  }

  @Post('login')
  async login(
    @Body(new ZodValidationPipe(LoginSchema)) body: LoginDto,
    @Req() req: any,
    @Res({ passthrough: true }) res: any,
  ) {
    const out = await this.auth.login(body, req.headers?.['user-agent'], req.ip)
    if ('accessToken' in out && (out as any).role) {
      setAdminRoleCookie(res, (out as any).role)
    }
    return out
  }

  @Post('refresh')
  async refresh(@Body(new ZodValidationPipe(RefreshSchema)) body: RefreshDto, @Req() req: any) {
    return this.auth.refresh(body.refreshToken, req.ip, req.headers?.['user-agent'])
  }

  // -------------------------------------------------------------------------
  // v0.4 M5-BE — 2FA (TOTP)
  // -------------------------------------------------------------------------

  @Post('2fa/setup')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async totpSetup(@Req() req: any) {
    return this.totp.generateSecret(req.user.userId)
  }

  @Post('2fa/verify')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async totpVerify(
    @Req() req: any,
    @Body(new ZodValidationPipe(TotpVerifySchema)) body: TotpVerifyDto,
  ) {
    return this.totp.verifyAndEnable(req.user.userId, body.code)
  }

  @Post('2fa/disable')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async totpDisable(
    @Req() req: any,
    @Body(new ZodValidationPipe(TotpVerifySchema)) body: TotpVerifyDto,
  ) {
    return this.totp.disable(req.user.userId, body.code)
  }

  /**
   * 2FA 활성 계정의 로그인 2단계. 1단계에서 `{ needsTotp, userId }` 를 받은
   * 클라이언트가 userId + 6자리 code 로 최종 session 획득.
   */
  @Post('2fa/login')
  async totpLogin(
    @Body(new ZodValidationPipe(TotpLoginSchema)) body: TotpLoginDto,
    @Req() req: any,
    @Res({ passthrough: true }) res: any,
  ) {
    const out = await this.auth.loginWithTotp(
      body.userId,
      body.code,
      (uid, c) => this.totp.verifyCode(uid, c),
      req.headers?.['user-agent'],
      req.ip,
    )
    if ((out as any).role) setAdminRoleCookie(res, (out as any).role)
    return out
  }
}
