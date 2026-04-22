/**
 * M3-5: 결제 confirm 경로 검증 (PortOne 서버 검증 + idempotent 가드 + 금액 불일치).
 */
import { beforeAll, describe, it, expect } from 'vitest'
import { OrderStatus, LedgerType } from '@prisma/client'
import { prisma } from './_setup'
import {
  makeServices,
  clearAll,
  createUser,
  createOrder,
  confirmPayment,
  mockPortOne,
  getLedgers,
} from './fixtures'

const svc = makeServices()

describe('Payment.confirm — 포트원 서버검증', () => {
  beforeAll(async () => {
    await clearAll()
  })

  it('PAID + 금액 일치 → 주문 PAID + 원장 3개 생성', async () => {
    const A = await createUser(svc)
    const B = await createUser(svc, { referrerId: A.id })
    const C = await createUser(svc, { referrerId: B.id })
    const D = await createUser(svc, { referrerId: C.id })

    const order = await createOrder(svc, { userId: D.id, totalAmountKrw: 1_000_000n })
    const result = await confirmPayment(svc, {
      id: order.id,
      userId: D.id,
      paymentId: order.paymentId,
      totalAmountKrw: order.totalAmountKrw,
    })

    expect(result.status).toBe('PAID')
    expect(result.amountPaidKrw).toBe('1000000')

    const updated = await prisma.order.findUniqueOrThrow({ where: { id: order.id } })
    expect(updated.status).toBe(OrderStatus.PAID)

    const earns = await getLedgers(order.id, 'EARN')
    expect(earns).toHaveLength(3)
  })

  it('금액 불일치 → 409 AMOUNT_MISMATCH, 원장 생성 없음', async () => {
    await clearAll()
    const A = await createUser(svc)
    const B = await createUser(svc, { referrerId: A.id })
    const C = await createUser(svc, { referrerId: B.id })
    const D = await createUser(svc, { referrerId: C.id })

    const order = await createOrder(svc, { userId: D.id, totalAmountKrw: 1_000_000n })

    // PortOne이 "999,000원만 결제됨"으로 응답하는 상황
    mockPortOne(svc, {
      status: 'PAID',
      amount: { total: 999_000 },
      payMethod: 'CARD',
    })

    await expect(svc.payment.confirm(D.id, order.id, order.paymentId!)).rejects.toMatchObject({
      response: { code: 'AMOUNT_MISMATCH' },
    })

    const ledgers = await getLedgers(order.id)
    expect(ledgers).toHaveLength(0)
    // 주문 상태는 PENDING_PAYMENT 유지
    const after = await prisma.order.findUniqueOrThrow({ where: { id: order.id } })
    expect(after.status).toBe(OrderStatus.PENDING_PAYMENT)
  })

  it('PortOne 상태 FAILED → 400 PAYMENT_NOT_PAID', async () => {
    await clearAll()
    const A = await createUser(svc)
    const B = await createUser(svc, { referrerId: A.id })
    const D = await createUser(svc, { referrerId: B.id })

    const order = await createOrder(svc, { userId: D.id, totalAmountKrw: 500_000n })

    mockPortOne(svc, {
      status: 'FAILED',
      amount: { total: 500_000 },
    })

    await expect(svc.payment.confirm(D.id, order.id, order.paymentId!)).rejects.toMatchObject({
      response: { code: 'PAYMENT_NOT_PAID' },
    })
  })

  it('Idempotent replay — 같은 paymentId로 재호출 시 성공 응답, 원장 중복 생성 없음', async () => {
    await clearAll()
    const A = await createUser(svc)
    const B = await createUser(svc, { referrerId: A.id })
    const C = await createUser(svc, { referrerId: B.id })
    const D = await createUser(svc, { referrerId: C.id })

    const order = await createOrder(svc, { userId: D.id, totalAmountKrw: 1_000_000n })
    const first = await confirmPayment(svc, {
      id: order.id,
      userId: D.id,
      paymentId: order.paymentId,
      totalAmountKrw: order.totalAmountKrw,
    })
    expect(first.status).toBe('PAID')

    // 두 번째 호출 — 동일 paymentId
    const second = await confirmPayment(svc, {
      id: order.id,
      userId: D.id,
      paymentId: order.paymentId,
      totalAmountKrw: order.totalAmountKrw,
    })
    expect(second.status).toBe('PAID')
    expect(second.message).toMatch(/idempotent/i)

    // 원장은 여전히 3개
    const earns = await getLedgers(order.id, 'EARN')
    expect(earns).toHaveLength(3)
  })

  it('다른 유저의 주문 confirm 시도 → 404 ORDER_NOT_FOUND', async () => {
    await clearAll()
    const A = await createUser(svc)
    const B = await createUser(svc, { referrerId: A.id })

    const order = await createOrder(svc, { userId: A.id, totalAmountKrw: 100_000n })
    await expect(svc.payment.confirm(B.id, order.id, order.paymentId!)).rejects.toMatchObject({
      response: { code: 'ORDER_NOT_FOUND' },
    })
  })

  it('paymentId 미리 배정된 값과 body 불일치 → 400 PAYMENT_ID_MISMATCH', async () => {
    await clearAll()
    const A = await createUser(svc)
    const order = await createOrder(svc, { userId: A.id, totalAmountKrw: 100_000n })
    mockPortOne(svc, { status: 'PAID', amount: { total: 100_000 } })

    await expect(
      svc.payment.confirm(A.id, order.id, 'fake_payment_id_xxxxx'),
    ).rejects.toMatchObject({ response: { code: 'PAYMENT_ID_MISMATCH' } })
  })
})
