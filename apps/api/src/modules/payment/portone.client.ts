import { Injectable, Logger } from '@nestjs/common'

/**
 * Thin wrapper around PortOne V2 server SDK.
 *
 * In production: import `{ PortOneClient } from '@portone/server-sdk'` and
 * delegate. This shim exposes exactly the methods we depend on so the rest
 * of the app is SDK-version-agnostic and can be mocked in tests.
 */

export interface PortOnePayment {
  id: string
  status: 'READY' | 'PAID' | 'FAILED' | 'PARTIAL_CANCELLED' | 'CANCELLED' | 'VIRTUAL_ACCOUNT_ISSUED'
  amount: { total: number | string }
  currency: string
  payMethod?: string
  orderName?: string
  customData?: string
  paidAt?: string
}

@Injectable()
export class PortOneClient {
  private readonly logger = new Logger('PortOneClient')
  private readonly storeId = process.env.PORTONE_STORE_ID ?? ''
  private readonly apiSecret = process.env.PORTONE_API_SECRET ?? ''

  async getPayment(paymentId: string): Promise<PortOnePayment> {
    // Real impl (pseudo-code):
    //   const sdk = PortOneClient({ secret: this.apiSecret })
    //   return sdk.payment.getPayment({ paymentId })
    const res = await fetch(`https://api.portone.io/payments/${encodeURIComponent(paymentId)}`, {
      headers: { Authorization: `PortOne ${this.apiSecret}` },
    })
    if (!res.ok) {
      throw new Error(`PortOne getPayment failed: ${res.status}`)
    }
    return (await res.json()) as PortOnePayment
  }

  async cancelPayment(
    paymentId: string,
    opts: { reason: string; amount?: bigint },
  ): Promise<{ status: string }> {
    const body: Record<string, unknown> = { reason: opts.reason }
    if (opts.amount != null) body.amount = Number(opts.amount)
    const res = await fetch(
      `https://api.portone.io/payments/${encodeURIComponent(paymentId)}/cancel`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `PortOne ${this.apiSecret}`,
        },
        body: JSON.stringify(body),
      },
    )
    if (!res.ok) throw new Error(`PortOne cancelPayment failed: ${res.status}`)
    return (await res.json()) as { status: string }
  }
}
