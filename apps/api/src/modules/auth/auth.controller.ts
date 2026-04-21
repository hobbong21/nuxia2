import { Body, Controller, Post, Req } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { AuthService } from './auth.service'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'

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

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('signup')
  async signup(@Body(new ZodValidationPipe(SignupSchema)) body: SignupDto, @Req() req: any) {
    return this.auth.signup({ ...body, ip: req.ip })
  }

  @Post('login')
  async login(@Body(new ZodValidationPipe(LoginSchema)) body: LoginDto, @Req() req: any) {
    return this.auth.login(body, req.headers?.['user-agent'], req.ip)
  }
}
