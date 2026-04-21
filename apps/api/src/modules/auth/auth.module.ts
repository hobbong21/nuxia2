import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { JwtStrategy } from './jwt.strategy'
import { UserModule } from '../user/user.module'
import { IdentityVerificationClient } from './identity.client'

// QA P1-06: JWT_SECRET fallback 제거. main.ts 에서 bootstrap 전 이미 검증.
// 이 모듈 단독 임포트 시에도 secret 이 없으면 즉시 실패.
function requireJwtSecret(): string {
  const s = process.env.JWT_SECRET
  if (!s || s.length < 32) {
    throw new Error('JWT_SECRET must be set (>= 32 chars). Aborting.')
  }
  return s
}

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: requireJwtSecret(),
      signOptions: { expiresIn: process.env.JWT_ACCESS_TTL ?? '2h' },
    }),
    UserModule,
  ],
  providers: [AuthService, JwtStrategy, IdentityVerificationClient],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
