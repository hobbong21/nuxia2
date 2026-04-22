import { Global, Module } from '@nestjs/common'
import { AuditService } from './audit.service'
import { AuditLogInterceptor } from './audit.interceptor'

/**
 * v0.4 M4 — Audit 모듈. Global 로 등록해 모든 피처 모듈이 바로 쓸 수 있도록 함.
 */
@Global()
@Module({
  providers: [AuditService, AuditLogInterceptor],
  exports: [AuditService, AuditLogInterceptor],
})
export class AuditModule {}
