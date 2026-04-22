import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.module'

export interface AuditLogInput {
  actorUserId: string
  kind: string
  targetType?: string
  targetId?: string | null
  reason?: string | null
  payload?: Record<string, unknown> | null
}

/**
 * v0.4 M4 — Audit log 서비스.
 *
 * 기존 Prisma AuditLog 모델에 1:1 매핑. interceptor 가 자동 주입하지만,
 * 서비스 로직 안에서 직접 부르고 싶은 경우에도 이 메서드를 사용.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger('AuditService')

  constructor(private readonly prisma: PrismaService) {}

  async log(input: AuditLogInput) {
    const target = input.targetId
      ? `${input.targetType ?? 'User'}:${input.targetId}`
      : null
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: input.actorUserId,
          action: input.kind,
          target,
          reason: input.reason ?? null,
          payload: (input.payload as any) ?? undefined,
        },
      })
    } catch (e) {
      // audit 실패가 비즈니스 로직을 멈추면 안 됨. 로그만 남김.
      this.logger.error(
        `AuditLog insert failed (${input.kind}): ${(e as Error).message}`,
      )
    }
  }
}
