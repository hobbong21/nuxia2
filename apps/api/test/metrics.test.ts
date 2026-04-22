/**
 * v0.4 M3 — Metrics counters 테스트.
 * prom-client 부재 시 in-memory 폴백을 사용해 counter 증가를 확인.
 */
import { beforeAll, describe, it, expect } from 'vitest'
import { prisma } from './_setup'
import { MetricsService } from '../src/modules/metrics/metrics.service'
import { PrismaService } from '../src/common/prisma.module'

describe('Metrics — v0.4 M3', () => {
  let metrics: MetricsService

  beforeAll(async () => {
    metrics = new MetricsService(prisma as unknown as PrismaService)
    metrics.onModuleInit()
  })

  it('custom counter 증가 → snapshot 반영 + text format 렌더', async () => {
    metrics.incReferralDistribute('success')
    metrics.incReferralDistribute('success')
    metrics.incReferralDistribute('skipped')
    metrics.incPaymentConfirm('mismatch')
    metrics.incAbuseBlocked('SELF_REFERRAL')
    metrics.incWebhookReceived('portone', 'ok')

    const snap = metrics.snapshot()
    expect(snap.referral.success).toBe(2)
    expect(snap.referral.skipped).toBe(1)
    expect(snap.payment.mismatch).toBe(1)
    expect(snap.abuse.SELF_REFERRAL).toBe(1)
    expect(snap.webhook['portone|ok']).toBe(1)

    const { contentType, body } = await metrics.render()
    expect(contentType).toMatch(/^text\/plain/)
    expect(body).toContain('nuxia2_referral_distribute_total')
    expect(body).toContain('nuxia2_payment_confirm_total')
    expect(body).toContain('nuxia2_abuse_blocked_total')
    expect(body).toContain('nuxia2_webhook_received_total')
    expect(body).toContain('nuxia2_minor_hold_total')
  })

  it('minorHold gauge — DB count 기반 refresh', async () => {
    const n = await metrics.refreshMinorHold()
    expect(typeof n).toBe('number')
    expect(n).toBeGreaterThanOrEqual(0)
    const snap = metrics.snapshot()
    expect(snap.minorHold).toBe(n)
  })
})
