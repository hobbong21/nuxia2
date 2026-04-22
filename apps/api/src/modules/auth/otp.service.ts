import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { randomInt } from 'node:crypto'
import { PrismaService } from '../../common/prisma.module'
import type { OtpKind } from '@prisma/client'
import { SolapiAdapter } from './adapters/sms.adapter'
import { NodemailerAdapter } from './adapters/email.adapter'

// NestJS 10에는 TooManyRequestsException이 기본 export 되지 않아서 로컬 대체 구현
class TooMany extends BadRequestException {
  constructor(message: string) {
    super({ statusCode: 429, message, code: 'OTP_RATE_LIMIT' })
  }
}

const OTP_CODE_TTL_SEC = 180 // 3분
const OTP_REQUEST_COOLDOWN_SEC = 60 // 같은 유저 재요청 쿨다운
const OTP_MAX_ATTEMPTS = 5

/**
 * v0.5 M3 — OTP 서비스 (SMS/Email 백업 2FA).
 *
 * 로그인 경로:
 *  - TOTP 미설정/분실 계정이 `requestOtp` 호출 → 6자리 코드 발송(adapter, dry-run 가능)
 *  - 사용자가 받은 코드로 `verifyOtp` → 로그인 세션 발급 (auth.service가 호출)
 *
 * 마이페이지 경로: 동일 엔드포인트, 세션 기반 userId.
 */
@Injectable()
export class OtpService {
  private readonly logger = new Logger('OtpService')

  constructor(
    private readonly prisma: PrismaService,
    private readonly sms: SolapiAdapter,
    private readonly email: NodemailerAdapter,
  ) {}

  /**
   * OTP 코드 생성 + 해시 저장 + 어댑터 발송.
   * 60초 내 재요청은 거부(429).
   */
  async requestOtp(userId: string, kind: OtpKind): Promise<{ ok: true; expiresInSec: number }> {
    // rate limit: 60초 내 기존 요청 존재하면 거부
    const cooldownAgo = new Date(Date.now() - OTP_REQUEST_COOLDOWN_SEC * 1000)
    const recent = await this.prisma.otpChallenge.findFirst({
      where: { userId, createdAt: { gte: cooldownAgo } },
      orderBy: { createdAt: 'desc' },
    })
    if (recent) {
      throw new TooMany(
        `OTP 재요청은 ${OTP_REQUEST_COOLDOWN_SEC}초 뒤에 가능합니다.`,
      )
    }

    // 사용자 / 채널 검증
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } })
    if (kind === 'SMS' && !user.phoneE164) {
      throw new BadRequestException({ code: 'NO_PHONE', message: '등록된 휴대폰 번호가 없습니다.' })
    }
    if (kind === 'EMAIL' && !user.email) {
      throw new BadRequestException({ code: 'NO_EMAIL', message: '등록된 이메일이 없습니다.' })
    }

    const code = randomInt(100_000, 1_000_000).toString().padStart(6, '0')
    const codeHash = await bcryptHash(code)
    const expiresAt = new Date(Date.now() + OTP_CODE_TTL_SEC * 1000)

    await this.prisma.otpChallenge.create({
      data: { userId, kind, codeHash, expiresAt },
    })

    const body = `[Nuxia2] 인증번호는 ${code} 입니다. ${Math.round(OTP_CODE_TTL_SEC / 60)}분 내 입력해주세요.`
    if (kind === 'SMS') {
      await this.sms.send({ to: user.phoneE164!, body })
    } else {
      await this.email.send({
        to: user.email,
        subject: '[Nuxia2] 로그인 인증번호',
        text: body,
      })
    }

    return { ok: true, expiresInSec: OTP_CODE_TTL_SEC }
  }

  /**
   * OTP 코드 검증.
   *  - 5회 연속 실패 시 lockout(403)
   *  - 만료 시 400
   *  - 성공 시 usedAt 기록, 동일 코드 재사용 불가
   */
  async verifyOtp(userId: string, kind: OtpKind, code: string): Promise<{ ok: true }> {
    const latest = await this.prisma.otpChallenge.findFirst({
      where: { userId, kind, usedAt: null },
      orderBy: { createdAt: 'desc' },
    })
    if (!latest) {
      throw new NotFoundException({ code: 'OTP_NOT_FOUND', message: 'OTP 요청 내역이 없습니다.' })
    }

    if (latest.attemptCount >= OTP_MAX_ATTEMPTS) {
      throw new ForbiddenException({ code: 'OTP_LOCKED', message: 'OTP 검증 시도 횟수 초과.' })
    }

    if (latest.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException({ code: 'OTP_EXPIRED', message: 'OTP 만료. 다시 요청하세요.' })
    }

    const ok = await bcryptCompare(code, latest.codeHash)
    if (!ok) {
      await this.prisma.otpChallenge.update({
        where: { id: latest.id },
        data: { attemptCount: { increment: 1 } },
      })
      throw new BadRequestException({ code: 'OTP_MISMATCH', message: 'OTP 코드가 일치하지 않습니다.' })
    }

    await this.prisma.otpChallenge.update({
      where: { id: latest.id },
      data: { usedAt: new Date() },
    })
    return { ok: true }
  }
}

// -------------------------------------------------------------------
// bcrypt soft-dependency
// -------------------------------------------------------------------
// 프로덕션: `bcrypt` 패키지 사용.
// 의존성 미설치 환경(테스트)에서는 SHA-256 fallback으로 최소 기능 유지.
// (코드 해시는 민감하지 않음 — 3분 TTL + 5회 제한 보호)

async function bcryptHash(plain: string): Promise<string> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const bcrypt = require('bcrypt')
    return await bcrypt.hash(plain, 10)
  } catch {
    const { createHash } = await import('node:crypto')
    return 'sha256:' + createHash('sha256').update(plain).digest('hex')
  }
}

async function bcryptCompare(plain: string, hash: string): Promise<boolean> {
  if (hash.startsWith('sha256:')) {
    const { createHash } = await import('node:crypto')
    const computed = createHash('sha256').update(plain).digest('hex')
    return hash === 'sha256:' + computed
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const bcrypt = require('bcrypt')
    return await bcrypt.compare(plain, hash)
  } catch {
    return false
  }
}
