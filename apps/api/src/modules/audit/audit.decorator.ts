import { SetMetadata } from '@nestjs/common'

/**
 * v0.4 M4 — Audit 데코레이터.
 *
 * 사용법:
 *   @Audit('USER_FLAG')
 *   @Post('users/:id/flag')
 *   flagUser(@Param('id') id: string) { ... }
 *
 * 메타데이터 → AuditLogInterceptor 가 읽어 성공 응답 시 AuditLog 1건 삽입.
 * targetType 은 첫 번째 path param 에서 암묵 추정하거나 두 번째 인자로 지정.
 */
export const AUDIT_METADATA_KEY = 'nuxia.audit'

export interface AuditMeta {
  kind: string
  /** 기본 "User". "Payout" 등 다른 리소스 대상일 때 명시. */
  targetType?: string
  /** true 면 body 전체를 payload 에 기록 (민감정보 유출 주의) */
  captureBody?: boolean
}

export function Audit(
  kind: string,
  opts: Partial<Omit<AuditMeta, 'kind'>> = {},
) {
  const meta: AuditMeta = {
    kind,
    targetType: opts.targetType ?? 'User',
    captureBody: opts.captureBody ?? false,
  }
  return SetMetadata(AUDIT_METADATA_KEY, meta)
}
