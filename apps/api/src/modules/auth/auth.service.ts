import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { PrismaService } from '../../common/prisma.module'
import { UserService } from '../user/user.service'
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'crypto'
import { IdentityVerificationClient } from './identity.client'
import { serializeUser } from '../../common/util/serialize.util'

export interface SignupInput {
  email: string
  password: string
  nickname: string
  referralCode?: string
  identityVerificationId: string
  deviceFingerprint?: string
  ip?: string
}

export interface LoginInput {
  email: string
  password: string
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger('AuthService')

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly userService: UserService,
    private readonly identity: IdentityVerificationClient,
  ) {}

  /**
   * Signup.
   * QA P0-01: 서버가 identityVerificationId 로 포트원에서 ci 를 재조회하여 저장.
   * QA P0-02: AuthResponseSchema 전체 반환 ({ accessToken, refreshToken, user }),
   *           user.identityVerified / user.age 포함.
   */
  async signup(input: SignupInput) {
    const verification = await this.identity.get(input.identityVerificationId)
    if (verification.status !== 'VERIFIED' || !verification.verifiedCustomer?.ci) {
      throw new BadRequestException({
        code: 'IDENTITY_NOT_VERIFIED',
        message: `identity-verification not VERIFIED (status=${verification.status})`,
      })
    }
    const ci = verification.verifiedCustomer.ci
    const dateOfBirth = verification.verifiedCustomer.birthDate
    const phoneNumber = verification.verifiedCustomer.phoneNumber

    const user = await this.userService.createUser({
      email: input.email,
      passwordHash: hashPassword(input.password),
      nickname: input.nickname,
      ci,
      dateOfBirth,
      phoneNumber,
      referralCode: input.referralCode,
      deviceFingerprint: input.deviceFingerprint,
      ip: input.ip,
    })

    const accessToken = this.issueAccessToken(user.id, user.role)
    const refreshToken = await this.issueRefreshToken(user.id, input.ip)
    return {
      accessToken,
      refreshToken,
      user: serializeUser(user),
    }
  }

  async login(input: LoginInput, userAgent?: string, ip?: string) {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } })
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' })
    }
    if (!verifyPassword(input.password, user.passwordHash)) {
      throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' })
    }
    if (user.status === 'WITHDRAWN' || user.status === 'BANNED') {
      throw new UnauthorizedException({ code: 'USER_INACTIVE', message: 'Account not available' })
    }
    const accessToken = this.issueAccessToken(user.id, user.role)
    const refreshToken = await this.issueRefreshToken(user.id, ip, userAgent)
    return {
      accessToken,
      refreshToken,
      user: serializeUser(user),
    }
  }

  issueAccessToken(userId: string, role: string) {
    return this.jwt.sign({ sub: userId, role })
  }

  /**
   * QA P0-02: refresh token = opaque random 32-byte base64url. DB에 Session
   * row 로 저장 (refreshHash만). 만료 TTL 은 JWT_REFRESH_TTL (기본 14d).
   * 실제 refresh 엔드포인트는 후속 작업이지만, FE가 AuthResponse 를 파싱해야
   * 하므로 최소한 토큰 발급 + 세션 저장은 여기서 완결.
   */
  async issueRefreshToken(userId: string, ip?: string, userAgent?: string): Promise<string> {
    const raw = randomBytes(32).toString('base64url')
    const refreshHash = createHash('sha256').update(raw).digest('hex')
    const ttl = parseTtl(process.env.JWT_REFRESH_TTL ?? '14d')
    const expiresAt = new Date(Date.now() + ttl)
    await this.prisma.session.create({
      data: {
        userId,
        refreshHash,
        userAgent: userAgent ?? null,
        ipHash: ip ? hashIp(ip) : null,
        expiresAt,
      },
    })
    return raw
  }
}

// --- password hashing (scrypt) ---
export function hashPassword(plain: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(plain, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(plain: string, stored: string): boolean {
  const [salt, hashHex] = stored.split(':')
  if (!salt || !hashHex) return false
  const expected = Buffer.from(hashHex, 'hex')
  const actual = scryptSync(plain, salt, 64)
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

export function hashIp(ip: string): string {
  return createHash('sha256')
    .update(ip + (process.env.APP_ENCRYPTION_SALT ?? ''))
    .digest('hex')
}

/** Parse `14d` / `2h` / `900s` into milliseconds. */
function parseTtl(s: string): number {
  const m = s.trim().match(/^(\d+)\s*([smhd])?$/i)
  if (!m) return 14 * 86_400_000
  const n = Number(m[1])
  const u = (m[2] ?? 's').toLowerCase()
  const mul: Record<string, number> =
    { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }
  return n * (mul[u] ?? 1000)
}
