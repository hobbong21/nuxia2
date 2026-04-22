import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { currentCorrelationId } from '../../common/logger/correlation-id.store'

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
    const res = await fetch(`https://api.portone.io/payments/${encodeURIComponent(paymentId)}`, {
      headers: outboundHeaders({ Authorization: `PortOne ${this.apiSecret}` }),
    })
    if (!res.ok) {
      throw new Error(`PortOne getPayment failed: ${res.status}`)
    }
    return (await res.json()) as PortOnePayment
  }

  /**
   * QA P1-04: `opts.amount` 가 `bigint` 인 경우 `Number` 변환 시 안전성 검증.
   *  - Number.isFinite / Number.isInteger 통과
   *  - 양수 (0 이하 거절)
   *  - Number.MAX_SAFE_INTEGER 이하 (2^53-1 ≈ 9e15). 원화 단위로는 여유.
   */
  async cancelPayment(
    paymentId: string,
    opts: { reason: string; amount?: bigint },
  ): Promise<{ status: string }> {
    const body: Record<string, unknown> = { reason: opts.reason }
    if (opts.amount != null) {
      body.amount = coerceAmountToNumber(opts.amount)
    }
    const res = await fetch(
      `https://api.portone.io/payments/${encodeURIComponent(paymentId)}/cancel`,
      {
        method: 'POST',
        headers: outboundHeaders({
          'Content-Type': 'application/json',
          Authorization: `PortOne ${this.apiSecret}`,
        }),
        body: JSON.stringify(body),
      },
    )
    if (!res.ok) throw new Error(`PortOne cancelPayment failed: ${res.status}`)
    return (await res.json()) as { status: string }
  }
}

/**
 * v0.4 S1 — outbound 요청에 correlation-id 를 `X-Request-Id` 로 전달.
 * 로컬 ALS 에 correlation-id 가 있을 때만 헤더 추가.
 */
function outboundHeaders(base: Record<string, string>): Record<string, string> {
  const cid = currentCorrelationId()
  return cid ? { ...base, 'X-Request-Id': cid } : base
}

export function coerceAmountToNumber(amount: bigint): number {
  if (typeof amount !== 'bigint') {
    throw new BadRequestException({
      code: 'CANCEL_AMOUNT_INVALID',
      message: `amount must be bigint, got ${typeof amount}`,
    })
  }
  if (amount <= 0n) {
    throw new BadRequestException({
      code: 'CANCEL_AMOUNT_INVALID',
      message: `cancel amount must be positive: ${amount}`,
    })
  }
  const max = BigInt(Number.MAX_SAFE_INTEGER)
  if (amount > max) {
    throw new BadRequestException({
      code: 'CANCEL_AMOUNT_INVALID',
      message: `cancel amount exceeds MAX_SAFE_INTEGER: ${amount}`,
    })
  }
  const n = Number(amount)
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    throw new BadRequestException({
      code: 'CANCEL_AMOUNT_INVALID',
      message: `cancel amount failed Number conversion: ${amount}`,
    })
  }
  return n
}
