/**
 * M3-6: Boundary Shape 검증
 *
 * 백엔드 서비스의 serializeXxx 출력이 shared-types zod 스키마와 1:1 매칭인지 검증.
 * 이것은 "API 응답 shape ↔ FE 기대 타입" 계약의 런타임 가드레일 (경계면 버그 패턴 #1).
 */
import { beforeAll, describe, it, expect } from 'vitest'
import {
  UserSchema,
  OrderSchema,
  OrderItemSchema,
  ProductSchema,
  PaymentConfirmResponseSchema,
  ReferralLedgerSchema,
  ShippingAddressSchema,
} from '@nuxia2/shared-types'
import { prisma } from './_setup'
import { serializeUser } from '../src/common/util/serialize.util'
import { serializeOrder } from '../src/modules/order/order.service'
import { makeServices, clearAll, createUser, createOrder, confirmPayment } from './fixtures'

const svc = makeServices()

describe('Boundary shape — shared-types zod 매칭', () => {
  beforeAll(async () => {
    await clearAll()
  })

  it('UserSchema: serializeUser 결과가 safeParse 통과', async () => {
    const A = await createUser(svc)
    const raw = await prisma.user.findUniqueOrThrow({ where: { id: A.id } })
    const dto = serializeUser(raw)
    const parsed = UserSchema.safeParse(dto)
    expect(parsed.success, JSON.stringify(parsed)).toBe(true)
  })

  it('ProductSchema: Prisma Product → shape 매칭 (BigInt → string 직렬화 포함)', async () => {
    // 테스트 제품 생성
    const p = await prisma.product.upsert({
      where: { slug: 'shape-product' },
      update: {},
      create: {
        slug: 'shape-product',
        name: 'Shape Product',
        description: 'desc',
        listPriceKrw: 100_000n,
        salePriceKrw: 80_000n,
        discountPct: 20,
        brandName: 'TestBrand',
        stock: 100,
        category: '의류',
        images: ['https://cdn.test/img.jpg'],
        referralPreviewBps: 2500,
        avgRating: 4.5,
        reviewCount: 12,
        status: 'ACTIVE',
      },
    })
    const dto = {
      id: p.id,
      slug: p.slug,
      name: p.name,
      brandName: p.brandName,
      categoryName: p.category,
      status: p.status,
      listPriceKrw: p.listPriceKrw.toString(),
      salePriceKrw: p.salePriceKrw.toString(),
      discountPct: p.discountPct,
      stock: p.stock,
      images: p.images.map((u) => ({ url: u, alt: '' })),
      description: p.description,
      referralPreviewBps: p.referralPreviewBps ?? 2500,
      avgRating: p.avgRating,
      reviewCount: p.reviewCount,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    }
    const parsed = ProductSchema.safeParse(dto)
    expect(parsed.success, JSON.stringify(parsed)).toBe(true)
  })

  it('OrderSchema + OrderItemSchema: serializeOrder 결과 매칭', async () => {
    const A = await createUser(svc)
    const order = await createOrder(svc, { userId: A.id, totalAmountKrw: 500_000n })
    const full = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { items: true },
    })
    const dto = serializeOrder(full)
    const parsed = OrderSchema.safeParse(dto)
    expect(parsed.success, JSON.stringify(parsed)).toBe(true)

    for (const item of dto.items) {
      const itemParsed = OrderItemSchema.safeParse(item)
      expect(itemParsed.success).toBe(true)
    }
  })

  it('PaymentConfirmResponseSchema: confirm 응답 매칭', async () => {
    await clearAll()
    const A = await createUser(svc)
    const order = await createOrder(svc, { userId: A.id, totalAmountKrw: 300_000n })
    const resp = await confirmPayment(svc, {
      id: order.id,
      userId: A.id,
      paymentId: order.paymentId,
      totalAmountKrw: order.totalAmountKrw,
    })
    const parsed = PaymentConfirmResponseSchema.safeParse(resp)
    expect(parsed.success, JSON.stringify(parsed)).toBe(true)
  })

  it('ReferralLedgerSchema: EARN 원장 row → shape 매칭', async () => {
    await clearAll()
    const A = await createUser(svc)
    const B = await createUser(svc, { referrerId: A.id })
    const C = await createUser(svc, { referrerId: B.id })
    const D = await createUser(svc, { referrerId: C.id })
    const order = await createOrder(svc, { userId: D.id, totalAmountKrw: 1_000_000n })
    await confirmPayment(svc, {
      id: order.id,
      userId: D.id,
      paymentId: order.paymentId,
      totalAmountKrw: order.totalAmountKrw,
    })

    const rows = await prisma.referralLedger.findMany({ where: { orderId: order.id } })
    expect(rows.length).toBe(3)
    for (const row of rows) {
      const dto = {
        id: row.id,
        orderId: row.orderId,
        beneficiaryUserId: row.beneficiaryUserId,
        generation: row.generation,
        rateBps: row.rateBps,
        amountKrw: row.amountKrw.toString(),
        type: row.type,
        status: row.status,
        reason: row.reason ?? null,
        createdAt: row.createdAt.toISOString(),
      }
      const parsed = ReferralLedgerSchema.safeParse(dto)
      expect(parsed.success, JSON.stringify(parsed)).toBe(true)
    }
  })

  it('ShippingAddressSchema: 최소 필드 객체 매칭', () => {
    const addr = {
      recipientName: '홍길동',
      phone: '01012345678',
      zipCode: '06236',
      address1: '서울시 강남구 …',
      address2: '',
    }
    const parsed = ShippingAddressSchema.safeParse(addr)
    expect(parsed.success).toBe(true)
  })

  it('BigInt 직렬화: 금액 string 경로 검증 (Shape Drift 패턴 #1 방지)', () => {
    const bigKrw = 9_999_999_999_999_999n // 수조 단위
    // 문자열 변환은 Number 정밀도 손실 없음
    expect(bigKrw.toString()).toBe('9999999999999999')
    // zod BigIntStringSchema 는 decimal integer 문자열만 허용
    const { BigIntStringSchema } = require('@nuxia2/shared-types')
    expect(BigIntStringSchema.safeParse('9999999999999999').success).toBe(true)
    expect(BigIntStringSchema.safeParse('abc').success).toBe(false)
    expect(BigIntStringSchema.safeParse('1.5').success).toBe(false)
  })
})
