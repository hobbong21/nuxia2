import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { PrismaService } from '../../common/prisma.module'
import { UserService } from '../user/user.service'
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'crypto'

export interface SignupInput {
  email: string
  password: string
  nickname: string
  referralCode?: string
  ci: string                // plaintext from identity-verification flow
  dateOfBirth?: string      // ISO
  phoneNumber?: string
  deviceFingerprint?: string
  ip?: string
}

export interface LoginInput {
  email: string
  password: string
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly userService: UserService,
  ) {}

  async signup(input: SignupInput) {
    const user = await this.userService.createUser({
      ...input,
      passwordHash: hashPassword(input.password),
    })
    return {
      user: redactUser(user),
      accessToken: this.issueAccessToken(user.id, user.role),
    }
  }

  async login(input: LoginInput) {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } })
    if (!user || !user.passwordHash) throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' })
    if (!verifyPassword(input.password, user.passwordHash)) {
      throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' })
    }
    if (user.status === 'WITHDRAWN' || user.status === 'BANNED') {
      throw new UnauthorizedException({ code: 'USER_INACTIVE', message: 'Account not available' })
    }
    return {
      user: redactUser(user),
      accessToken: this.issueAccessToken(user.id, user.role),
    }
  }

  issueAccessToken(userId: string, role: string) {
    return this.jwt.sign({ sub: userId, role })
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

function redactUser(u: any) {
  const { passwordHash, ci, ciHash, phoneNumber, ...rest } = u
  return rest
}

export function hashIp(ip: string): string {
  return createHash('sha256')
    .update(ip + (process.env.APP_ENCRYPTION_SALT ?? ''))
    .digest('hex')
}
