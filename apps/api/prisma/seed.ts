/**
 * Nuxia v0.2.0 Seed — 개발/테스트 고정 시드
 *
 * 생성 내용
 *  - 4대 체인: A (root) → B (1세대) → C (2세대) → D (3세대) 모두 ACTIVE + identityVerified
 *  - STAFF 계정 1명 (레퍼럴 참여 불가 테스트용)
 *  - 상품 10종 (가격 5,000 ~ 500,000원, 이미지 placeholder)
 *  - 주문 3건: PAID/PENDING/PAID+환불용
 *  - PayoutTaxConfig 1건 (withholding 3.30% BUSINESS_INCOME)
 *
 * 주의
 *  - NODE_ENV === 'production' 이면 즉시 거부 (실수 방지)
 *  - APP_ENCRYPTION_KEY / APP_ENCRYPTION_SALT 필요 (ci 암호화 + ciHash 계산)
 *  - 실행:  pnpm --filter @nuxia2/api exec prisma db seed
 */

import { PrismaClient, Prisma } from '@prisma/client'
import {
  encryptCi,
  hashCi,
  encryptPii,
} from '../src/common/util/crypto.util'
import { scryptSync, randomBytes } from 'crypto'

const prisma = new PrismaClient()

// 결정적 CI 생성기 (각 유저별 고정 ci — 실제 환경에선 포트원 본인인증 결과).
function makeCi(label: string): string {
  return `CI_SEED_${label.padEnd(10, '_')}_${'0'.repeat(32)}`.slice(0, 88)
}

function hashPassword(plain: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(plain, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

async function cleanupDev() {
  // 외래키 순서 고려: 하위 먼저 삭제
  await prisma.referralLedger.deleteMany()
  await prisma.refund.deleteMany()
  await prisma.orderItem.deleteMany()
  await prisma.order.deleteMany()
  await prisma.cartItem.deleteMany()
  await prisma.cart.deleteMany()
  await prisma.payout.deleteMany()
  await prisma.payoutTaxConfig.deleteMany()
  await prisma.bankAccount.deleteMany()
  await prisma.session.deleteMany()
  await prisma.webhookEvent.deleteMany()
  await prisma.auditLog.deleteMany()
  await prisma.abuseLog.deleteMany()
  await prisma.product.deleteMany()
  await prisma.user.deleteMany()
}

async function seedUsers() {
  const passwordHash = hashPassword('test1234!')
  const baseDob = new Date('1990-01-01')

  // A — root (referrerId=null, ancestorPath=[])
  const aCi = makeCi('A')
  const A = await prisma.user.create({
    data: {
      email: 'a@nuxia.test',
      nickname: '체인A_루트',
      passwordHash,
      ci: encryptCi(aCi),
      ciHash: hashCi(aCi),
      dateOfBirth: baseDob,
      phoneNumber: encryptPii('010-0000-0001'),
      role: 'CUSTOMER',
      status: 'ACTIVE',
      payoutEligibility: true,
      referralCode: 'CHAIN_A',
      referrerId: null,
      ancestorPath: [],
    },
  })

  const bCi = makeCi('B')
  const B = await prisma.user.create({
    data: {
      email: 'b@nuxia.test',
      nickname: '체인B_1세대',
      passwordHash,
      ci: encryptCi(bCi),
      ciHash: hashCi(bCi),
      dateOfBirth: baseDob,
      phoneNumber: encryptPii('010-0000-0002'),
      role: 'CUSTOMER',
      status: 'ACTIVE',
      payoutEligibility: true,
      referralCode: 'CHAIN_B',
      referrerId: A.id,
      ancestorPath: [A.id],
    },
  })

  const cCi = makeCi('C')
  const C = await prisma.user.create({
    data: {
      email: 'c@nuxia.test',
      nickname: '체인C_2세대',
      passwordHash,
      ci: encryptCi(cCi),
      ciHash: hashCi(cCi),
      dateOfBirth: baseDob,
      phoneNumber: encryptPii('010-0000-0003'),
      role: 'CUSTOMER',
      status: 'ACTIVE',
      payoutEligibility: true,
      referralCode: 'CHAIN_C',
      referrerId: B.id,
      ancestorPath: [B.id, A.id],
    },
  })

  const dCi = makeCi('D')
  const D = await prisma.user.create({
    data: {
      email: 'd@nuxia.test',
      nickname: '체인D_3세대',
      passwordHash,
      ci: encryptCi(dCi),
      ciHash: hashCi(dCi),
      dateOfBirth: baseDob,
      phoneNumber: encryptPii('010-0000-0004'),
      role: 'CUSTOMER',
      status: 'ACTIVE',
      payoutEligibility: true,
      referralCode: 'CHAIN_D',
      referrerId: C.id,
      ancestorPath: [C.id, B.id, A.id],
    },
  })

  // STAFF — T6 테스트용 (referrer/referee 양쪽 불가 검증)
  const staffCi = makeCi('STAFF')
  const STAFF = await prisma.user.create({
    data: {
      email: 'staff@nuxia.test',
      nickname: '임직원_테스트',
      passwordHash,
      ci: encryptCi(staffCi),
      ciHash: hashCi(staffCi),
      dateOfBirth: baseDob,
      phoneNumber: encryptPii('010-0000-9999'),
      role: 'STAFF',
      status: 'ACTIVE',
      payoutEligibility: false,
      referralCode: 'STAFF001',
      referrerId: null,
      ancestorPath: [],
    },
  })

  return { A, B, C, D, STAFF }
}

async function seedProducts() {
  // 상품 10종 — 가격대 다양화, shared-types ProductSchema.images(url) 요구사항 충족
  const specs: Array<{
    slug: string
    name: string
    brand: string
    list: bigint
    sale: bigint
    category: string
  }> = [
    { slug: 'tee-white',     name: '베이직 화이트 티셔츠',    brand: 'NUXIA Basic', list:  19_000n, sale:   5_000n, category: 'apparel' },
    { slug: 'socks-pack',    name: '무채색 양말 5팩',         brand: 'DailyWear',   list:  15_000n, sale:  10_000n, category: 'apparel' },
    { slug: 'mug-ceramic',   name: '세라믹 머그 320ml',       brand: 'Kitchenlab',  list:  18_000n, sale:  12_000n, category: 'homegoods' },
    { slug: 'tote-canvas',   name: '캔버스 토트백',           brand: 'BagCraft',    list:  35_000n, sale:  25_000n, category: 'bags' },
    { slug: 'hoodie-gray',   name: '그레이 후디',             brand: 'NUXIA Basic', list:  79_000n, sale:  49_000n, category: 'apparel' },
    { slug: 'skincare-set',  name: '수분 스킨케어 3종 세트',  brand: 'GlowLab',     list: 120_000n, sale:  89_000n, category: 'beauty' },
    { slug: 'sneakers-low',  name: '로우탑 스니커즈',         brand: 'StepOne',     list: 139_000n, sale: 100_000n, category: 'shoes' },
    { slug: 'backpack-pro',  name: '프로 백팩 22L',           brand: 'BagCraft',    list: 189_000n, sale: 149_000n, category: 'bags' },
    { slug: 'watch-smart',   name: '스마트 워치 2세대',       brand: 'TechNova',    list: 299_000n, sale: 249_000n, category: 'electronics' },
    { slug: 'laptop-stand',  name: '알루미늄 노트북 스탠드',  brand: 'Workspace',   list: 580_000n, sale: 500_000n, category: 'electronics' },
  ]

  const products = []
  for (const s of specs) {
    const discountPct = Number(((s.list - s.sale) * 100n) / s.list)
    const p = await prisma.product.create({
      data: {
        slug: s.slug,
        name: s.name,
        brandName: s.brand,
        description: `${s.name} — 시드 데이터 상품. 테스트용.`,
        listPriceKrw: s.list,
        salePriceKrw: s.sale,
        discountPct,
        stock: 100,
        category: s.category,
        images: [
          `https://placehold.co/600x600?text=${encodeURIComponent(s.slug)}-1`,
          `https://placehold.co/600x600?text=${encodeURIComponent(s.slug)}-2`,
        ],
        referralPreviewBps: 2500,
        avgRating: 4.2,
        reviewCount: 12,
        status: 'ACTIVE',
      },
    })
    products.push(p)
  }
  return products
}

async function seedOrders(users: {
  A: { id: string }
  B: { id: string }
  C: { id: string }
  D: { id: string }
}, products: Array<{ id: string; name: string; salePriceKrw: bigint; images: string[] }>) {
  // 주문1: D가 100,000원 (1 item) → PAID, 레퍼럴 EARN 3건 생성 가능한 상태
  // NOTE: seed 에서는 ReferralLedger 까지 직접 기입하지 않고, confirm API 흐름이 만들도록 상태만 세팅.
  const p1 = products.find((p) => p.salePriceKrw === 100_000n)!
  const order1 = await prisma.order.create({
    data: {
      userId: users.D.id,
      items: {
        create: [
          {
            productId: p1.id,
            productNameSnapshot: p1.name,
            imageUrlSnapshot: p1.images[0] ?? null,
            unitPriceKrw: p1.salePriceKrw,
            quantity: 1,
            lineAmountKrw: p1.salePriceKrw,
          },
        ],
      },
      subtotalAmountKrw: 100_000n,
      totalAmountKrw: 100_000n,
      couponDiscountKrw: 0n,
      pointUsedKrw: 0n,
      shippingFeeKrw: 0n,
      status: 'PAID',
      paymentId: 'seed-payment-order1',
      paymentMethod: 'CARD',
      confirmedAt: new Date(),
      shippingAddress: {
        recipientName: '체인D_3세대',
        phone: '010-0000-0004',
        zipCode: '04524',
        address1: '서울 중구 을지로 100',
        address2: '101동 1001호',
      } as Prisma.InputJsonValue,
    },
  })

  // 주문2: C가 50,000원 — PENDING_PAYMENT
  const p2 = products.find((p) => p.salePriceKrw === 49_000n)!
  const order2 = await prisma.order.create({
    data: {
      userId: users.C.id,
      items: {
        create: [
          {
            productId: p2.id,
            productNameSnapshot: p2.name,
            imageUrlSnapshot: p2.images[0] ?? null,
            unitPriceKrw: p2.salePriceKrw,
            quantity: 1,
            lineAmountKrw: p2.salePriceKrw,
          },
        ],
      },
      subtotalAmountKrw: 49_000n,
      totalAmountKrw: 49_000n,
      status: 'PENDING_PAYMENT',
    },
  })

  // 주문3: B가 200,000원 (2 items) — PAID + 환불 테스트용
  const p3a = products.find((p) => p.salePriceKrw === 100_000n)!
  const p3b = products.find((p) => p.salePriceKrw === 100_000n)!
  const order3 = await prisma.order.create({
    data: {
      userId: users.B.id,
      items: {
        create: [
          {
            productId: p3a.id,
            productNameSnapshot: p3a.name,
            imageUrlSnapshot: p3a.images[0] ?? null,
            unitPriceKrw: p3a.salePriceKrw,
            quantity: 1,
            lineAmountKrw: p3a.salePriceKrw,
          },
          {
            productId: p3b.id,
            productNameSnapshot: p3b.name,
            imageUrlSnapshot: p3b.images[0] ?? null,
            unitPriceKrw: p3b.salePriceKrw,
            quantity: 1,
            lineAmountKrw: p3b.salePriceKrw,
          },
        ],
      },
      subtotalAmountKrw: 200_000n,
      totalAmountKrw: 200_000n,
      status: 'PAID',
      paymentId: 'seed-payment-order3',
      paymentMethod: 'CARD',
      confirmedAt: new Date(),
    },
  })

  return { order1, order2, order3 }
}

async function seedTaxConfig() {
  await prisma.payoutTaxConfig.create({
    data: {
      effectiveFrom: new Date('2026-01-01T00:00:00Z'),
      withholdingBps: 330, // 3.30%
      kind: 'BUSINESS_INCOME',
      note: 'v0.2.0 default — 일반 사업소득 3.3% 원천징수',
    },
  })
}

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Seed aborted: NODE_ENV=production')
  }

  if (!process.env.APP_ENCRYPTION_KEY) {
    // 시드 전용 고정 키 (개발 환경만). prod에서는 위 guard로 중단됨.
    process.env.APP_ENCRYPTION_KEY =
      '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff'
  }
  if (!process.env.APP_ENCRYPTION_SALT) {
    process.env.APP_ENCRYPTION_SALT = 'nuxia-seed-salt'
  }

  console.log('[seed] cleanup existing rows...')
  await cleanupDev()

  console.log('[seed] users (4 chain + 1 staff)...')
  const users = await seedUsers()

  console.log('[seed] products (10)...')
  const products = await seedProducts()

  console.log('[seed] orders (3)...')
  const orders = await seedOrders(users, products)

  console.log('[seed] payout tax config (1)...')
  await seedTaxConfig()

  console.log('[seed] done.')
  console.log({
    users: Object.fromEntries(
      Object.entries(users).map(([k, v]) => [k, (v as any).id]),
    ),
    productCount: products.length,
    orderIds: Object.values(orders).map((o) => (o as any).id),
  })
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
