import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common'
import { PrismaService } from '../../common/prisma.module'
import { encryptPii, decryptPii } from '../../common/util/crypto.util'

/**
 * v0.4 M5-BE — TOTP (RFC 6238) 2FA 서비스.
 *
 * `otplib` 를 소프트-디펜던시로 취급. 미설치 환경(CI/테스트)에서는
 * 내장 HMAC-SHA1 기반 폴백 구현을 사용해 핵심 로직(generate/verify/disable)
 * 이 그대로 동작하도록 한다.
 *
 * Secret 은 AES-256-GCM 암호문으로 DB 에 저장된다.
 */
@Injectable()
export class TotpService {
  private readonly logger = new Logger('TotpService')

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Setup: 새 secret 생성 + DB 저장 + otpauth URL 반환.
   * totpEnabled 는 아직 false (verify() 에서 true 전환).
   */
  async generateSecret(userId: string): Promise<{
    otpauthUrl: string
    qrDataUri: string
    secret: string
  }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
      throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'user not found' })
    }
    const secret = generateBase32Secret(20)
    const issuer = encodeURIComponent(process.env.TOTP_ISSUER ?? 'nuxia2')
    const label = encodeURIComponent(user.email)
    const otpauthUrl = `otpauth://totp/${issuer}:${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        totpSecret: encryptPii(secret),
        totpEnabled: false,
        totpEnabledAt: null,
      },
    })

    const qrDataUri = await renderQrDataUri(otpauthUrl)
    return { otpauthUrl, qrDataUri, secret }
  }

  /**
   * Verify: 유효 코드면 totpEnabled=true + enabledAt 기록.
   */
  async verifyAndEnable(userId: string, code: string): Promise<{ enabled: true }> {
    const ok = await this.verifyCode(userId, code)
    if (!ok) {
      throw new UnauthorizedException({
        code: 'TOTP_INVALID',
        message: 'Invalid TOTP code',
      })
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { totpEnabled: true, totpEnabledAt: new Date() },
    })
    return { enabled: true }
  }

  /**
   * 로그인 2단계 (totpEnabled=true 계정) 에서 호출.
   * DB 업데이트 없이 검증만.
   */
  async verifyCode(userId: string, code: string): Promise<boolean> {
    if (!/^\d{6}$/.test(code)) {
      throw new BadRequestException({
        code: 'TOTP_CODE_FORMAT',
        message: 'TOTP code must be 6 digits',
      })
    }
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user || !user.totpSecret) return false
    const secret = decryptPii(user.totpSecret)
    return verifyTotp(secret, code)
  }

  /**
   * Disable: 현재 코드로 검증 후 비활성.
   */
  async disable(userId: string, code: string): Promise<{ enabled: false }> {
    const ok = await this.verifyCode(userId, code)
    if (!ok) {
      throw new UnauthorizedException({
        code: 'TOTP_INVALID',
        message: 'Invalid TOTP code',
      })
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { totpEnabled: false, totpSecret: null, totpEnabledAt: null },
    })
    return { enabled: false }
  }
}

// ---------------------------------------------------------------------------
// TOTP primitives (RFC 6238, SHA-1, 30s step, 6 digits)
// ---------------------------------------------------------------------------

import { createHmac, randomBytes } from 'crypto'

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

export function generateBase32Secret(byteLen = 20): string {
  const buf = randomBytes(byteLen)
  return toBase32(buf)
}

function toBase32(buf: Buffer): string {
  let bits = 0
  let value = 0
  let out = ''
  for (const byte of buf) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 0x1f]
      bits -= 5
    }
  }
  if (bits > 0) {
    out += BASE32_ALPHABET[(value << (5 - bits)) & 0x1f]
  }
  return out
}

function fromBase32(s: string): Buffer {
  const clean = s.replace(/=+$/g, '').toUpperCase()
  let bits = 0
  let value = 0
  const bytes: number[] = []
  for (const ch of clean) {
    const idx = BASE32_ALPHABET.indexOf(ch)
    if (idx < 0) continue
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return Buffer.from(bytes)
}

/** RFC 6238 TOTP generate. Exposed so unit tests can produce a valid code. */
export function totpFor(secretBase32: string, at: Date = new Date()): string {
  const step = 30
  const counter = Math.floor(at.getTime() / 1000 / step)
  const key = fromBase32(secretBase32)
  const buf = Buffer.alloc(8)
  // 64-bit big-endian counter
  buf.writeUInt32BE(Math.floor(counter / 0x1_0000_0000), 0)
  buf.writeUInt32BE(counter >>> 0, 4)
  const h = createHmac('sha1', key).update(buf).digest()
  const offset = h[h.length - 1] & 0x0f
  const bin =
    ((h[offset] & 0x7f) << 24) |
    ((h[offset + 1] & 0xff) << 16) |
    ((h[offset + 2] & 0xff) << 8) |
    (h[offset + 3] & 0xff)
  const code = (bin % 1_000_000).toString().padStart(6, '0')
  return code
}

/** Verify with ±1 step tolerance (30s) to cover clock skew. */
export function verifyTotp(
  secretBase32: string,
  code: string,
  at: Date = new Date(),
): boolean {
  const step = 30 * 1000
  for (const delta of [-1, 0, 1]) {
    const t = new Date(at.getTime() + delta * step)
    if (totpFor(secretBase32, t) === code) return true
  }
  return false
}

/**
 * QR data URI. 프로덕션에서는 `qrcode` 라이브러리로 PNG 생성,
 * 테스트/CI 환경(패키지 부재) 에서는 otpauth URL 자체를 base64 로 감싼
 * 플레이스홀더 data: URI 를 반환해 API 계약을 깨지 않도록 한다.
 */
async function renderQrDataUri(otpauthUrl: string): Promise<string> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const qrcode = require('qrcode')
    if (qrcode && typeof qrcode.toDataURL === 'function') {
      return (await qrcode.toDataURL(otpauthUrl)) as string
    }
  } catch {
    /* fall through */
  }
  const payload = Buffer.from(otpauthUrl, 'utf8').toString('base64')
  return `data:text/plain;base64,${payload}`
}
