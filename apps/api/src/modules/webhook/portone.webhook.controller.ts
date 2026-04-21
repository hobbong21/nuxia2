import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  Logger,
  Post,
} from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { createHmac, timingSafeEqual } from 'crypto'
import { PrismaService } from '../../common/prisma.module'
import { PaymentService } from '../payment/payment.service'

/**
 * PortOne V2 webhook ingestion endpoint.
 *
 *  - Validate `webhook-signature` HMAC with PORTONE_WEBHOOK_SECRET.
 *  - Idempotent via (source, externalId, eventType, eventTimestamp).
 *  - Async handlers (payment paid, cancelled, virtual-account deposited).
 */
@ApiTags('webhook')
@Controller('webhooks/portone')
export class PortoneWebhookController {
  private readonly logger = new Logger('PortoneWebhook')

  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentService,
  ) {}

  @Post()
  @HttpCode(200)
  async handle(
    @Headers('x-portone-signature') sig: string | undefined,
    @Headers('webhook-signature') altSig: string | undefined,
    @Body() body: any,
  ) {
    const secret = process.env.PORTONE_WEBHOOK_SECRET ?? ''
    const signature = sig ?? altSig ?? ''
    const rawBody = typeof body === 'string' ? body : JSON.stringify(body)
    if (!verifyHmac(rawBody, signature, secret)) {
      this.logger.warn('Invalid webhook signature')
      throw new BadRequestException({ code: 'WEBHOOK_BAD_SIGNATURE', message: 'bad sig' })
    }

    const paymentId = body?.data?.paymentId ?? body?.paymentId
    const eventType = body?.type ?? body?.eventType ?? 'unknown'
    const eventTimestamp = body?.timestamp ?? body?.eventTimestamp ?? new Date().toISOString()
    if (!paymentId) {
      throw new BadRequestException({ code: 'WEBHOOK_BAD_PAYLOAD', message: 'missing paymentId' })
    }

    // Idempotency via WebhookEvent unique key
    try {
      await this.prisma.webhookEvent.create({
        data: {
          source: 'portone',
          externalId: paymentId,
          eventType,
          eventTimestamp: new Date(eventTimestamp),
          payload: body,
          signatureOk: true,
        },
      })
    } catch (e: any) {
      if (e?.code === 'P2002') {
        this.logger.log(`duplicate webhook ignored: ${paymentId}:${eventType}`)
        return { ok: true, duplicate: true }
      }
      throw e
    }

    // Dispatch (best-effort; server re-verifies with PortOne anyway)
    try {
      if (eventType.includes('PAID') || eventType.includes('Paid')) {
        // Find the corresponding order; PortOne `customData` normally carries orderId
        const data = body?.data ?? body
        const orderId = data?.customData?.orderId ?? data?.orderId
        if (orderId) {
          // Best-effort confirm. Real confirm must re-fetch PortOne and validate.
          // We do NOT invoke confirm here without userId; leave that to client.
          this.logger.log(`Webhook notes PAID for order ${orderId}`)
        }
      }
    } finally {
      await this.prisma.webhookEvent.updateMany({
        where: { externalId: paymentId, eventType },
        data: { processedAt: new Date() },
      })
    }
    return { ok: true }
  }
}

function verifyHmac(rawBody: string, signature: string, secret: string): boolean {
  if (!secret) return false
  if (!signature) return false
  const mac = createHmac('sha256', secret).update(rawBody).digest('hex')
  const a = Buffer.from(mac, 'hex')
  const b = Buffer.from(signature.replace(/^sha256=/, ''), 'hex')
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
