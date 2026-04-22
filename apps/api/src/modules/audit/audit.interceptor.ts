import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { Observable, tap } from 'rxjs'
import { AuditService } from './audit.service'
import { AUDIT_METADATA_KEY, AuditMeta } from './audit.decorator'

/**
 * v0.4 M4 — `@Audit(kind)` 로 마킹된 컨트롤러 메서드의 성공 응답 시 AuditLog 생성.
 *
 * actorUserId: req.user.userId (JwtStrategy 에서 주입)
 * targetId   : req.params.id (없으면 null)
 * payload    : captureBody=true 면 body 전체 (기본 false)
 */
@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const meta = this.reflector.get<AuditMeta>(
      AUDIT_METADATA_KEY,
      context.getHandler(),
    )
    if (!meta) return next.handle()

    const req = context.switchToHttp().getRequest<any>()
    const actorUserId: string | undefined = req?.user?.userId ?? req?.user?.sub
    const targetId: string | undefined = req?.params?.id

    return next.handle().pipe(
      tap(() => {
        if (!actorUserId) return
        void this.audit.log({
          actorUserId,
          kind: meta.kind,
          targetType: meta.targetType ?? 'User',
          targetId: targetId ?? null,
          reason: req?.body?.reason ?? null,
          payload: meta.captureBody ? (req?.body ?? null) : null,
        })
      }),
    )
  }
}
