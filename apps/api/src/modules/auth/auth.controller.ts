import { Body, Controller, Post, Req } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { AuthService } from './auth.service'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'

export const SignupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(100),
  nickname: z.string().min(1).max(40),
  referralCode: z.string().optional(),
  ci: z.string().min(1),
  dateOfBirth: z.string().optional(),
  phoneNumber: z.string().optional(),
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
  async login(@Body(new ZodValidationPipe(LoginSchema)) body: LoginDto) {
    return this.auth.login(body)
  }
}
