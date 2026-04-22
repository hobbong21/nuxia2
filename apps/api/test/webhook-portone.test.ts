/**
 * v0.3 M4-1: PortOne Webhook HMAC + idempotency 통합 테스트.
 *
 * PaymentModule/ReferralModule 등 full DI 그래프 부팅 비용을 피하기 위해
 * `PortoneWebhookController` 를 직접 new 해서 호출한다. 테스트 커버리지:
 *
 *   1. 유효한 HMAC 서명 → 200 OK + WebhookEvent 1건 생성
 *   2. 잘못된 서명 → BadRequestException (WEBHOOK_BAD_SIGNATURE)
 *   3. 동일 이벤트 재전송 → duplicate:true, WebhookEvent 는 1건만
 *   4. 서로 다른 eventType + 동일 paymentId → 각각 별개 레코드 기록
 *   5. ALLOW_UNSIGNED_WEBHOOK=1 + NODE_ENV!=production → 서명 없이 통과
 *   6. ALLOW_UNSIGNED_WEBHOOK=1 + NODE_ENV=production → 여전히 거부
 *
 * HMAC 규격은 컨트롤러 구현과 일치해야 한다:
 *   signature = hex(hmac-sha256(secret, rawBody))
 *   (optional `sha256=` prefix 허용)
 */
import { beforeAll, beforeEach, afterAll, describe, it, expect } from 'vitest'
import { createHmac } from 'node:crypto'
import { BadRequestException } from '@nestjs/common'
import { prisma } from './_setup'
import { clearAll } from './fixtures'
import type { PrismaService } from '../src/common/prisma.module'
import type { PaymentService } from '../src/modules/payment/payment.service'
import { PortoneWebhookController } from '../src/modules/webhook/portone.webhook.controller'

// --------------------------------------------------------------------------
// Test harness — we instantiate the controller with a live Prisma and a
// stub PaymentService. The controller's current dispatch path does not
// actually invoke PaymentService for webhook-only ingestion (it logs, then
// updates processedAt), so the stub can remain minimal.
// --------------------------------------------------------------------------
const SECRET = 'test-webhook-secret-v0.3'

class NoopPaymentService {}

function makeController() {
  return new PortoneWebhookController(
    prisma as unknown as PrismaService,
    new NoopPaymentService() as unknown as PaymentService,
  )
}

function sign(body: unknown, secret = SECRET): string {
  const raw = typeof body === 'string' ? body : JSON.stringify(body)
  return createHmac('sha256', secret).update(raw).digest('hex')
}

interface BuildPayloadOpts {
  paymentId?: string
  type?: string
  timestamp?: string
  orderId?: string
}

function buildPayload(opts: BuildPayloadOpts = {}) {
  return {
    type: opts.type ?? 'Transaction.Paid',
    timestamp: opts.timestamp ?? '2026-04-21T00:00:00.000Z',
    data: {
      paymentId: opts.paymentId ?? 'pay_test_001',
      customData: { orderId: opts.orderId ?? 'order_test_001' },
    },
  }
}

// Snapshot env so individual tests can mutate without leaking.
const envSnapshot = {
  secret: process.env.PORTONE_WEBHOOK_SECRET,
  allow: process.env.ALLOW_UNSIGNED_WEBHOOK,
  node: process.env.NODE_ENV,
}

describe('Webhook — PortOne signature + idempotency', () => {
  beforeAll(async () => {
    await clearAll()
    process.env.PORTONE_WEBHOOK_SECRET = SECRET
  })

  beforeEach(async () => {
    // Each test starts with a clean WebhookEvent table and default env toggles.
    await prisma.webhookEvent.deleteMany({})
    process.env.PORTONE_WEBHOOK_SECRET = SECRET
    delete process.env.ALLOW_UNSIGNED_WEBHOOK
    delete process.env.NODE_ENV
  })

  afterAll(() => {
    // Restore env so subsequent suites are unaffected.
    if (envSnapshot.secret == null) delete process.env.PORTONE_WEBHOOK_SECRET
    else process.env.PORTONE_WEBHOOK_SECRET = envSnapshot.secret
    if (envSnapshot.allow == null) delete process.env.ALLOW_UNSIGNED_WEBHOOK
    else process.env.ALLOW_UNSIGNED_WEBHOOK = envSnapshot.allow
    if (envSnapshot.node == null) delete process.env.NODE_ENV
    else process.env.NODE_ENV = envSnapshot.node
  })

  it('유효한 HMAC 서명 → 200 OK + WebhookEvent 1건 생성', async () => {
    const ctl = makeController()
    const body = buildPayload({ paymentId: 'pay_valid_001' })
    const sig = sign(body)

    const res = await ctl.handle(sig, undefined, body)
    expect(res).toMatchObject({ ok: true })

    const rows = await prisma.webhookEvent.findMany({
      where: { externalId: 'pay_valid_001' },
    })
    expect(rows).toHaveLength(1)
    expect(rows[0].source).toBe('portone')
    expect(rows[0].eventType).toBe('Transaction.Paid')
    expect(rows[0].signatureOk).toBe(true)
    // dispatch block updates processedAt in a finally — must be set.
    expect(rows[0].processedAt).not.toBeNull()
  })

  it('잘못된 서명 → BadRequestException(WEBHOOK_BAD_SIGNATURE), WebhookEvent 없음', async () => {
    const ctl = makeController()
    const body = buildPayload({ paymentId: 'pay_badsig_001' })
    const badSig = 'deadbeef'.repeat(8) // valid hex, wrong MAC

    await expect(ctl.handle(badSig, undefined, body)).rejects.toBeInstanceOf(
      BadRequestException,
    )

    const rows = await prisma.webhookEvent.findMany({
      where: { externalId: 'pay_badsig_001' },
    })
    expect(rows).toHaveLength(0)
  })

  it('동일 이벤트 재전송 → duplicate:true, WebhookEvent 중복 생성 없음', async () => {
    const ctl = makeController()
    const body = buildPayload({
      paymentId: 'pay_dup_001',
      type: 'Transaction.Paid',
      timestamp: '2026-04-21T01:00:00.000Z',
    })
    const sig = sign(body)

    const first = await ctl.handle(sig, undefined, body)
    expect(first).toMatchObject({ ok: true })
    expect((first as any).duplicate).toBeUndefined()

    // 동일 body 재전송 (unique: source+externalId+eventType+eventTimestamp).
    const second = await ctl.handle(sig, undefined, body)
    expect(second).toMatchObject({ ok: true, duplicate: true })

    const rows = await prisma.webhookEvent.findMany({
      where: { externalId: 'pay_dup_001' },
    })
    expect(rows).toHaveLength(1)
  })

  it('서로 다른 eventType + 동일 paymentId → 각각 별개 레코드', async () => {
    const ctl = makeController()
    const paid = buildPayload({
      paymentId: 'pay_multi_001',
      type: 'Transaction.Paid',
      timestamp: '2026-04-21T02:00:00.000Z',
    })
    const cancelled = buildPayload({
      paymentId: 'pay_multi_001',
      type: 'Transaction.Cancelled',
      timestamp: '2026-04-21T02:05:00.000Z',
    })

    await ctl.handle(sign(paid), undefined, paid)
    await ctl.handle(sign(cancelled), undefined, cancelled)

    const rows = await prisma.webhookEvent.findMany({
      where: { externalId: 'pay_multi_001' },
      orderBy: { eventTimestamp: 'asc' },
    })
    expect(rows).toHaveLength(2)
    expect(rows[0].eventType).toBe('Transaction.Paid')
    expect(rows[1].eventType).toBe('Transaction.Cancelled')
  })

  it('ALLOW_UNSIGNED_WEBHOOK=1 + NODE_ENV!=production → 서명 없이 통과', async () => {
    process.env.ALLOW_UNSIGNED_WEBHOOK = '1'
    process.env.NODE_ENV = 'development'

    const ctl = makeController()
    const body = buildPayload({
      paymentId: 'pay_unsigned_dev_001',
      timestamp: '2026-04-21T03:00:00.000Z',
    })

    // 서명 완전 생략.
    const res = await ctl.handle(undefined, undefined, body)
    expect(res).toMatchObject({ ok: true })

    const rows = await prisma.webhookEvent.findMany({
      where: { externalId: 'pay_unsigned_dev_001' },
    })
    expect(rows).toHaveLength(1)
  })

  it('ALLOW_UNSIGNED_WEBHOOK=1 + NODE_ENV=production → 여전히 거부', async () => {
    process.env.ALLOW_UNSIGNED_WEBHOOK = '1'
    process.env.NODE_ENV = 'production'

    const ctl = makeController()
    const body = buildPayload({
      paymentId: 'pay_unsigned_prod_001',
      timestamp: '2026-04-21T04:00:00.000Z',
    })

    await expect(ctl.handle(undefined, undefined, body)).rejects.toBeInstanceOf(
      BadRequestException,
    )

    const rows = await prisma.webhookEvent.findMany({
      where: { externalId: 'pay_unsigned_prod_001' },
    })
    expect(rows).toHaveLength(0)
  })
})
