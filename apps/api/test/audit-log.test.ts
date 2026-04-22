/**
 * v0.4 M4 — Audit log 인터셉터 + 서비스 테스트.
 *
 *  - AuditService.log() 가 DB 에 AuditLog row 를 쓴다.
 *  - AuditLogInterceptor 가 `@Audit(kind)` 메타 + req.user 조합으로 자동 기록.
 */
import { beforeAll, describe, it, expect } from 'vitest'
import { of } from 'rxjs'
import { firstValueFrom } from 'rxjs'
import { Reflector } from '@nestjs/core'
import { prisma } from './_setup'
import { clearAll, createUser, makeServices } from './fixtures'
import { AuditService } from '../src/modules/audit/audit.service'
import { AuditLogInterceptor } from '../src/modules/audit/audit.interceptor'
import { AUDIT_METADATA_KEY } from '../src/modules/audit/audit.decorator'
import { PrismaService } from '../src/common/prisma.module'

describe('Audit — v0.4 M4', () => {
  let audit: AuditService

  beforeAll(async () => {
    await clearAll()
    audit = new AuditService(prisma as unknown as PrismaService)
  })

  it('AuditService.log() — DB 에 row 생성', async () => {
    const svc = makeServices()
    const A = await createUser(svc)
    const B = await createUser(svc)
    await audit.log({
      actorUserId: A.id,
      kind: 'USER_FLAG',
      targetType: 'User',
      targetId: B.id,
      reason: 'test',
      payload: { origin: 'unit-test' },
    })
    const rows = await prisma.auditLog.findMany({
      where: { actorId: A.id, action: 'USER_FLAG' },
    })
    expect(rows.length).toBe(1)
    expect(rows[0].target).toBe(`User:${B.id}`)
    expect(rows[0].reason).toBe('test')
  })

  it('AuditLogInterceptor — @Audit 메타 + req.user 조합으로 자동 기록', async () => {
    await clearAll()
    const svc = makeServices()
    const actor = await createUser(svc)
    const target = await createUser(svc)

    const reflector = new Reflector()
    const interceptor = new AuditLogInterceptor(reflector, audit)

    // Simulate a handler decorated with @Audit('USER_RELEASE_MINOR')
    const handler = () => {}
    Reflect.defineMetadata(
      AUDIT_METADATA_KEY,
      { kind: 'USER_RELEASE_MINOR', targetType: 'User', captureBody: false },
      handler,
    )

    const ctx: any = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { userId: actor.id },
          params: { id: target.id },
          body: {},
        }),
      }),
      getHandler: () => handler,
      getClass: () => ({}),
    }
    const call$: any = { handle: () => of({ ok: true }) }
    const out = await firstValueFrom(interceptor.intercept(ctx, call$) as any)
    expect(out).toEqual({ ok: true })

    // Give the tap() side-effect a moment to flush (tap is synchronous here but DB write is async)
    await new Promise((r) => setTimeout(r, 50))

    const rows = await prisma.auditLog.findMany({
      where: { actorId: actor.id, action: 'USER_RELEASE_MINOR' },
    })
    expect(rows.length).toBe(1)
    expect(rows[0].target).toBe(`User:${target.id}`)
  })
})
