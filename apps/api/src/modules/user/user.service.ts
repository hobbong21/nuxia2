import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { Prisma, UserRole, UserStatus } from '@prisma/client'
import { PrismaService } from '../../common/prisma.module'
import { encryptCi, encryptPii, hashCi, hashForAudit } from '../../common/util/crypto.util'
import { randomBytes } from 'crypto'

export interface CreateUserInput {
  email: string
  passwordHash: string
  nickname: string
  ci: string
  dateOfBirth?: string
  phoneNumber?: string
  referralCode?: string
  deviceFingerprint?: string
  ip?: string
}

@Injectable()
export class UserService {
  private readonly logger = new Logger('UserService')

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a user enforcing:
   *  - (A3) `ci` uniqueness via ciHash
   *  - (T5) WITHDRAWN cooldown = 30 days by ci
   *  - (A1) Self-referral: referrer.ciHash == new.ciHash
   *  - (A1) Ancestor self-referral: any ancestor.ciHash == new.ciHash
   *  - (A2) Circular: referrer's ancestorPath must not contain new userId (checked after insert)
   *  - (T6) STAFF / STAFF_FAMILY cannot be referrer OR referee
   *  - (T7) Minor (< 19 years) → status=MINOR_HOLD, payoutEligibility=false
   */
  async createUser(input: CreateUserInput) {
    const ciHash = hashCi(input.ci)
    const ciEnc = encryptCi(input.ci)
    const phoneEnc = input.phoneNumber ? encryptPii(input.phoneNumber) : null
    const dob = input.dateOfBirth ? new Date(input.dateOfBirth) : null

    return this.prisma.$transaction(
      async (tx) => {
        // (A3) duplicate `ci` (including WITHDRAWN cool-down check)
        const existing = await tx.user.findUnique({ where: { ciHash } })
        if (existing) {
          if (existing.status === 'WITHDRAWN') {
            // T5: 30-day cool-down
            const cooldownDays = Number(process.env.WITHDRAW_COOLDOWN_DAYS ?? 30)
            const ok =
              existing.withdrawnAt &&
              Date.now() - existing.withdrawnAt.getTime() >= cooldownDays * 86_400_000
            if (!ok) {
              await this.logAbuse(tx, 'WITHDRAW_REJOIN_COOLDOWN', {
                ciHash,
                withdrawnAt: existing.withdrawnAt,
                deviceFingerprint: input.deviceFingerprint,
              })
              throw new ConflictException({
                code: 'WITHDRAW_REJOIN_COOLDOWN',
                message: 'Rejoin blocked during cool-down window',
              })
            }
            // past cooldown: treat as a fresh account (keep old row as tombstone)
          } else {
            await this.logAbuse(tx, 'DUPLICATE_CI', { ciHash })
            throw new ConflictException({
              code: 'USER_CI_DUPLICATE',
              message: 'ci already registered',
            })
          }
        }

        // Resolve referrer
        let referrerId: string | null = null
        let ancestorPath: string[] = []

        if (input.referralCode) {
          const referrer = await tx.user.findUnique({ where: { referralCode: input.referralCode } })
          if (!referrer) {
            throw new BadRequestException({
              code: 'REFERRAL_NOT_FOUND',
              message: 'Invalid referral code',
            })
          }

          // (T6) STAFF guard
          if (referrer.role === UserRole.STAFF || referrer.role === UserRole.STAFF_FAMILY) {
            await this.logAbuse(tx, 'STAFF_REFERRAL', {
              referrerId: referrer.id,
              referrerRole: referrer.role,
            })
            throw new ForbiddenException({
              code: 'STAFF_REFERRAL_FORBIDDEN',
              message: 'Staff accounts cannot refer',
            })
          }

          // (A1) Direct self-referral
          if (referrer.ciHash === ciHash) {
            await this.logAbuse(tx, 'SELF_REFERRAL', { referrerId: referrer.id })
            throw new BadRequestException({
              code: 'REFERRAL_SELF_FORBIDDEN',
              message: 'Cannot refer yourself',
            })
          }

          // (A1) Ancestor self-referral via ancestorPath cache
          if (referrer.ancestorPath && referrer.ancestorPath.length > 0) {
            const ancestorHashes = await tx.user.findMany({
              where: { id: { in: referrer.ancestorPath } },
              select: { ciHash: true },
            })
            if (ancestorHashes.some((a) => a.ciHash === ciHash)) {
              await this.logAbuse(tx, 'ANCESTOR_SELF_REFERRAL', { referrerId: referrer.id })
              throw new BadRequestException({
                code: 'REFERRAL_SELF_FORBIDDEN',
                message: 'Self referral detected in ancestor chain',
              })
            }
          }

          referrerId = referrer.id
          // ancestorPath of new user = [referrer, referrer.ancestorPath[0], referrer.ancestorPath[1]]
          ancestorPath = [referrer.id, ...(referrer.ancestorPath ?? [])].slice(0, 3)
        }

        // (T7) Minor check (< 19 years)
        let status: UserStatus = UserStatus.ACTIVE
        let payoutEligibility = true
        if (dob && isMinor(dob)) {
          status = UserStatus.MINOR_HOLD
          payoutEligibility = false
        }

        // Generate a unique short referral code
        const referralCode = await generateReferralCode(tx)

        const created = await tx.user.create({
          data: {
            email: input.email,
            passwordHash: input.passwordHash,
            nickname: input.nickname,
            ci: ciEnc,
            ciHash,
            phoneNumber: phoneEnc,
            dateOfBirth: dob,
            status,
            payoutEligibility,
            referralCode,
            referrerId,
            ancestorPath,
          },
        })

        // (A2) Circular parent check: if somehow referrer chain includes the new id
        // (Can't happen normally — referrer existed before us — but we assert.)
        if (referrerId && ancestorPath.includes(created.id)) {
          await this.logAbuse(tx, 'CIRCULAR', { newId: created.id, referrerId })
          throw new ConflictException({
            code: 'REFERRAL_CYCLE_DETECTED',
            message: 'Circular referral',
          })
        }

        return created
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    )
  }

  async getMe(userId: string) {
    const u = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!u) throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'User not found' })
    // QA P0-02: shared-types User 와 1:1 매칭 (identityVerified, age 포함)
    const { serializeUser } = await import('../../common/util/serialize.util')
    return serializeUser(u)
  }

  async withdraw(userId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { status: 'WITHDRAWN', withdrawnAt: new Date() },
    })
  }

  private async logAbuse(
    tx: Prisma.TransactionClient,
    kind: any,
    evidence: Record<string, unknown>,
  ) {
    await tx.abuseLog.create({
      data: { kind, severity: 3, evidence, action: 'BLOCKED' },
    })
  }
}

function isMinor(dob: Date): boolean {
  const now = new Date()
  const age =
    now.getFullYear() -
    dob.getFullYear() -
    (now < new Date(now.getFullYear(), dob.getMonth(), dob.getDate()) ? 1 : 0)
  return age < 19
}

async function generateReferralCode(tx: Prisma.TransactionClient): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const code = randomBytes(4).toString('base64url').replace(/[_-]/g, '').slice(0, 8).toUpperCase()
    const exists = await tx.user.findUnique({ where: { referralCode: code } })
    if (!exists) return code
  }
  throw new Error('Could not generate unique referral code')
}
