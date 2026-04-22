import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.module'

/**
 * v0.4 M3 — Prometheus metrics.
 *
 * `prom-client` 를 소프트-디펜던시로 취급한다:
 *   - 설치되어 있으면 정식 Counter/Gauge 를 사용.
 *   - 설치되지 않은 테스트/CI 환경에서는 in-memory 카운터로 폴백해
 *     단위 테스트가 의존성 설치 없이 통과하도록 한다.
 *
 * 5개 custom metric:
 *   - nuxia2_referral_distribute_total{result}
 *   - nuxia2_payment_confirm_total{result}
 *   - nuxia2_abuse_blocked_total{kind}
 *   - nuxia2_webhook_received_total{source,status}
 *   - nuxia2_minor_hold_total (gauge)
 *
 * 사용법:
 *   metrics.incReferralDistribute('success')
 *   metrics.incPaymentConfirm('mismatch')
 *   metrics.incAbuseBlocked('SELF_REFERRAL')
 *   metrics.incWebhookReceived('portone', 'ok')
 *   await metrics.refreshMinorHold()  // DB 카운트로 gauge 갱신
 */

type LabelCount = Map<string, number>

interface PromClientRegistryLike {
  registry: any
  Counter: any
  Gauge: any
  collectDefaultMetrics: (opts: { register: any }) => void
}

@Injectable()
export class MetricsService implements OnModuleInit {
  private readonly logger = new Logger('MetricsService')

  // --- Fallback in-memory counters (when prom-client missing) ---
  private readonly inMem: {
    referral: LabelCount
    payment: LabelCount
    abuse: LabelCount
    webhook: LabelCount
    minorHold: number
  } = {
    referral: new Map(),
    payment: new Map(),
    abuse: new Map(),
    webhook: new Map(),
    minorHold: 0,
  }

  // --- prom-client handles (set on init if available) ---
  private prom: PromClientRegistryLike | null = null
  private cReferral: any = null
  private cPayment: any = null
  private cAbuse: any = null
  private cWebhook: any = null
  private gMinorHold: any = null

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    this.initPromClient()
  }

  private initPromClient() {
    try {
      // dynamic require so missing dep does not crash boot
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const promClient = require('prom-client')
      const registry = new promClient.Registry()
      registry.setDefaultLabels({ app: 'nuxia2-api' })
      promClient.collectDefaultMetrics({ register: registry })
      this.prom = {
        registry,
        Counter: promClient.Counter,
        Gauge: promClient.Gauge,
        collectDefaultMetrics: promClient.collectDefaultMetrics,
      }

      this.cReferral = new promClient.Counter({
        name: 'nuxia2_referral_distribute_total',
        help: 'Referral distribute events (success|skipped|failed)',
        labelNames: ['result'],
        registers: [registry],
      })
      this.cPayment = new promClient.Counter({
        name: 'nuxia2_payment_confirm_total',
        help: 'Payment confirm outcomes (success|mismatch|failed)',
        labelNames: ['result'],
        registers: [registry],
      })
      this.cAbuse = new promClient.Counter({
        name: 'nuxia2_abuse_blocked_total',
        help: 'Abuse detection blocks by kind',
        labelNames: ['kind'],
        registers: [registry],
      })
      this.cWebhook = new promClient.Counter({
        name: 'nuxia2_webhook_received_total',
        help: 'Inbound webhook events (source,status)',
        labelNames: ['source', 'status'],
        registers: [registry],
      })
      this.gMinorHold = new promClient.Gauge({
        name: 'nuxia2_minor_hold_total',
        help: 'Current number of User rows with status=MINOR_HOLD',
        registers: [registry],
      })
      this.logger.log('prom-client initialised with 5 custom metrics')
    } catch (e) {
      this.logger.warn(
        `prom-client not available, falling back to in-memory counters: ${(e as Error).message}`,
      )
      this.prom = null
    }
  }

  // ----- Counter increment helpers -----

  incReferralDistribute(result: 'success' | 'skipped' | 'failed') {
    if (this.cReferral) this.cReferral.inc({ result })
    this.inMem.referral.set(result, (this.inMem.referral.get(result) ?? 0) + 1)
  }

  incPaymentConfirm(result: 'success' | 'mismatch' | 'failed') {
    if (this.cPayment) this.cPayment.inc({ result })
    this.inMem.payment.set(result, (this.inMem.payment.get(result) ?? 0) + 1)
  }

  incAbuseBlocked(kind: string) {
    if (this.cAbuse) this.cAbuse.inc({ kind })
    this.inMem.abuse.set(kind, (this.inMem.abuse.get(kind) ?? 0) + 1)
  }

  incWebhookReceived(
    source: string,
    status: 'ok' | 'duplicate' | 'rejected',
  ) {
    const key = `${source}|${status}`
    if (this.cWebhook) this.cWebhook.inc({ source, status })
    this.inMem.webhook.set(key, (this.inMem.webhook.get(key) ?? 0) + 1)
  }

  setMinorHold(n: number) {
    if (this.gMinorHold) this.gMinorHold.set(n)
    this.inMem.minorHold = n
  }

  async refreshMinorHold(): Promise<number> {
    const n = await this.prisma.user.count({ where: { status: 'MINOR_HOLD' } })
    this.setMinorHold(n)
    return n
  }

  /** Text exposition format for `/metrics` */
  async render(): Promise<{ contentType: string; body: string }> {
    // keep gauge fresh on scrape (cheap)
    try {
      await this.refreshMinorHold()
    } catch {
      /* ignore DB hiccup to keep metrics scrapable */
    }

    if (this.prom) {
      return {
        contentType: this.prom.registry.contentType,
        body: await this.prom.registry.metrics(),
      }
    }
    // fallback text output (still parseable as Prometheus text format)
    const lines: string[] = []
    lines.push('# HELP nuxia2_fallback 1 if prom-client absent')
    lines.push('# TYPE nuxia2_fallback gauge')
    lines.push('nuxia2_fallback 1')
    for (const [r, v] of this.inMem.referral) {
      lines.push(`nuxia2_referral_distribute_total{result="${r}"} ${v}`)
    }
    for (const [r, v] of this.inMem.payment) {
      lines.push(`nuxia2_payment_confirm_total{result="${r}"} ${v}`)
    }
    for (const [k, v] of this.inMem.abuse) {
      lines.push(`nuxia2_abuse_blocked_total{kind="${k}"} ${v}`)
    }
    for (const [k, v] of this.inMem.webhook) {
      const [src, st] = k.split('|')
      lines.push(`nuxia2_webhook_received_total{source="${src}",status="${st}"} ${v}`)
    }
    lines.push(`nuxia2_minor_hold_total ${this.inMem.minorHold}`)
    return { contentType: 'text/plain; version=0.0.4', body: lines.join('\n') + '\n' }
  }

  /** Test-only: returns current in-memory snapshot. */
  snapshot() {
    return {
      referral: Object.fromEntries(this.inMem.referral),
      payment: Object.fromEntries(this.inMem.payment),
      abuse: Object.fromEntries(this.inMem.abuse),
      webhook: Object.fromEntries(this.inMem.webhook),
      minorHold: this.inMem.minorHold,
    }
  }
}
