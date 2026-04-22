/**
 * Shared test fixtures & helpers.
 *
 * These helpers call `UserService`, `OrderService`, `PaymentService`,
 * `ReferralEngineService` directly (no HTTP layer). A live Prisma instance
 * is shared from `_setup.ts`.
 */
import { UserRole, UserStatus, OrderStatus, LedgerType, ProductStatus } from '@prisma/client'
import { PrismaService } from '../src/common/prisma.module'
import { UserService } from '../src/modules/user/user.service'
import { OrderService } from '../src/modules/order/order.service'
import { PaymentService } from '../src/modules/payment/payment.service'
import { ReferralEngineService } from '../src/modules/referral/engine.service'
import type { PortOneClient, PortOnePayment } from '../src/modules/payment/portone.client'
import { prisma } from './_setup'
import { randomBytes } from 'node:crypto'

// --------------------------------------------------------------------------
// Stub PortOne client — never hits the real network in tests.
// Tests override `__nextPayment` / `__nextCancel` as needed.
// --------------------------------------------------------------------------
export class StubPortOneClient {
  public getPaymentHandler: ((id: string) => Promise<PortOnePayment>) | null = null
  public cancelPaymentHandler:
    | ((id: string, opts: { reason: string; amount?: bigint }) => Promise<{ status: string }>)
    | null = null

  async getPayment(paymentId: string): Promise<PortOnePayment> {
    if (this.getPaymentHandler) return this.getPaymentHandler(paymentId)
    // Default: echo back as PAID with whatever amount the test sets via helper.
    throw new Error(
      `[StubPortOne] No getPaymentHandler installed for ${paymentId}. ` +
        `Use fixtures.mockPortOnePaid() or set handler explicitly.`,
    )
  }
  async cancelPayment(
    paymentId: string,
    opts: { reason: string; amount?: bigint },
  ): Promise<{ status: string }> {
    if (this.cancelPaymentHandler) return this.cancelPaymentHandler(paymentId, opts)
    return { status: 'CANCELLED' }
  }
}

// --------------------------------------------------------------------------
// Service factory — returns a single bag of services wired to `prisma`.
// --------------------------------------------------------------------------
export interface TestServices {
  prisma: PrismaService
  user: UserService
  order: OrderService
  payment: PaymentService
  referral: ReferralEngineService
  portone: StubPortOneClient
}

export function makeServices(): TestServices {
  // Cast — PrismaClient is a structural superset of PrismaService used by the
  // services here (only `$transaction`, `$queryRaw`, and model delegates).
  const prismaSvc = prisma as unknown as PrismaService
  const referral = new ReferralEngineService(prismaSvc)
  const portone = new StubPortOneClient()
  const payment = new PaymentService(
    prismaSvc,
    portone as unknown as PortOneClient,
    referral,
  )
  const order = new OrderService(prismaSvc)
  const user = new UserService(prismaSvc)
  return { prisma: prismaSvc, user, order, payment, referral, portone }
}

// --------------------------------------------------------------------------
// Tear-down helper — truncate in dependency-safe order.
// --------------------------------------------------------------------------
export async function clearAll() {
  // Use a single TRUNCATE ... CASCADE for speed + FK safety.
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "ReferralLedger",
      "Refund",
      "OrderItem",
      "Order",
      "CartItem",
      "Cart",
      "Payout",
      "PayoutTaxConfig",
      "BankAccount",
      "Session",
      "AbuseLog",
      "AuditLog",
      "WebhookEvent",
      "Product",
      "User"
    RESTART IDENTITY CASCADE
  `)
}

// --------------------------------------------------------------------------
// Fixture builders
// --------------------------------------------------------------------------

let _ciCounter = 0
export function uniqueCi(prefix = 'ci') {
  _ciCounter += 1
  return `${prefix}_${Date.now()}_${_ciCounter}_${randomBytes(3).toString('hex')}`
}

export interface CreateUserOpts {
  ci?: string
  email?: string
  nickname?: string
  role?: UserRole
  status?: UserStatus
  referrerId?: string
  referralCode?: string // inviter's code, used for signup path
  dateOfBirth?: string // ISO date
  phoneNumber?: string
  skipSignup?: boolean // use raw Prisma insert (bypass UserService guards)
}

/**
 * Create a user via UserService (applies A1/A2/A3/T5/T6/T7 guards).
 * If `referrerId` is provided, we look up the inviter's `referralCode`
 * and feed it through `UserService.createUser` like a real signup.
 */
export async function createUser(
  svc: TestServices,
  opts: CreateUserOpts = {},
): Promise<{ id: string; email: string; referralCode: string; ciHash: string }> {
  const ci = opts.ci ?? uniqueCi()
  const email = opts.email ?? `u_${_ciCounter}_${randomBytes(3).toString('hex')}@test.local`
  const nickname = opts.nickname ?? `user_${_ciCounter}`

  let referralCode = opts.referralCode
  if (!referralCode && opts.referrerId) {
    const r = await prisma.user.findUnique({ where: { id: opts.referrerId } })
    if (!r) throw new Error(`[fixtures.createUser] referrerId not found: ${opts.referrerId}`)
    referralCode = r.referralCode
  }

  if (opts.skipSignup) {
    // Raw insert path — used only when we need a STAFF / SUSPENDED / WITHDRAWN
    // seed that the guards would otherwise reject.
    const { hashCi, encryptCi } = await import('../src/common/util/crypto.util')
    const code = `RAW${Date.now()}${_ciCounter}`.slice(0, 12).toUpperCase()
    const created = await prisma.user.create({
      data: {
        email,
        passwordHash: 'test-hash',
        nickname,
        ci: encryptCi(ci),
        ciHash: hashCi(ci),
        phoneNumber: null,
        dateOfBirth: opts.dateOfBirth ? new Date(opts.dateOfBirth) : null,
        role: opts.role ?? UserRole.CUSTOMER,
        status: opts.status ?? UserStatus.ACTIVE,
        referralCode: code,
        referrerId: opts.referrerId ?? null,
        ancestorPath: [],
      },
    })
    return {
      id: created.id,
      email: created.email,
      referralCode: created.referralCode,
      ciHash: created.ciHash!,
    }
  }

  const u = await svc.user.createUser({
    email,
    passwordHash: 'test-hash',
    nickname,
    ci,
    referralCode,
    dateOfBirth: opts.dateOfBirth,
    phoneNumber: opts.phoneNumber,
  })

  // Post-hoc role/status overrides (after guards)
  if (opts.role && opts.role !== UserRole.CUSTOMER) {
    await prisma.user.update({ where: { id: u.id }, data: { role: opts.role } })
  }
  if (opts.status && opts.status !== UserStatus.ACTIVE) {
    await prisma.user.update({ where: { id: u.id }, data: { status: opts.status } })
  }

  return { id: u.id, email: u.email, referralCode: u.referralCode, ciHash: u.ciHash! }
}

/**
 * Create a "dummy" product and an order in PENDING_PAYMENT state.
 * Bypasses the OrderService when a precise `totalAmountKrw` is desired
 * (e.g. the 1,111,111원 rounding case) — uses raw Prisma instead.
 */
export async function createOrder(
  svc: TestServices,
  input: { userId: string; totalAmountKrw: bigint; subtotalAmountKrw?: bigint },
) {
  // Guarantee a product exists for the FK chain.
  const product = await prisma.product.upsert({
    where: { slug: 'test-product' },
    update: {},
    create: {
      slug: 'test-product',
      name: 'Test Product',
      listPriceKrw: input.totalAmountKrw,
      salePriceKrw: input.totalAmountKrw,
      discountPct: 0,
      stock: 9999,
      images: ['https://cdn.test/p.jpg'],
      status: ProductStatus.ACTIVE,
    },
  })

  const subtotal = input.subtotalAmountKrw ?? input.totalAmountKrw
  const order = await prisma.order.create({
    data: {
      userId: input.userId,
      totalAmountKrw: input.totalAmountKrw,
      subtotalAmountKrw: subtotal,
      couponDiscountKrw: 0n,
      pointUsedKrw: 0n,
      shippingFeeKrw: 0n,
      status: OrderStatus.PENDING_PAYMENT,
      paymentId: `payment_${randomBytes(8).toString('hex')}`,
      items: {
        create: [
          {
            productId: product.id,
            productNameSnapshot: product.name,
            imageUrlSnapshot: product.images[0] ?? null,
            unitPriceKrw: input.totalAmountKrw,
            quantity: 1,
            lineAmountKrw: input.totalAmountKrw,
          },
        ],
      },
    },
    include: { items: true },
  })
  return order
}

/**
 * Stub PortOne as "PAID for exactly `amountKrw`" and invoke PaymentService.confirm.
 */
export async function confirmPayment(
  svc: TestServices,
  order: { id: string; userId: string; paymentId: string | null; totalAmountKrw: bigint },
  overrides: Partial<PortOnePayment> = {},
) {
  svc.portone.getPaymentHandler = async (id) => ({
    id,
    status: 'PAID',
    amount: { total: Number(order.totalAmountKrw) },
    currency: 'KRW',
    payMethod: 'CARD',
    ...overrides,
  })
  return svc.payment.confirm(order.userId, order.id, order.paymentId!)
}

/**
 * Install a PortOne stub that returns the given payment shape as-is.
 */
export function mockPortOne(
  svc: TestServices,
  payment: Partial<PortOnePayment> & { status: PortOnePayment['status'] },
) {
  svc.portone.getPaymentHandler = async (id) =>
    ({
      id,
      currency: 'KRW',
      amount: { total: 0 },
      ...payment,
    }) as PortOnePayment
}

/**
 * Drive a full "D places order, paying succeeds, referrals distribute" flow.
 * Returns the order row and the list of ledgers written.
 */
export async function placePaidOrder(
  svc: TestServices,
  buyerId: string,
  amountKrw: bigint,
) {
  const order = await createOrder(svc, { userId: buyerId, totalAmountKrw: amountKrw })
  await confirmPayment(svc, {
    id: order.id,
    userId: buyerId,
    paymentId: order.paymentId,
    totalAmountKrw: amountKrw,
  })
  const ledgers = await getLedgers(order.id)
  return { order, ledgers }
}

export async function getLedgers(orderId: string, type?: 'EARN' | 'REVERT') {
  return prisma.referralLedger.findMany({
    where: { orderId, ...(type ? { type: type as LedgerType } : {}) },
    orderBy: { generation: 'asc' },
  })
}

export function findGen<T extends { generation: number }>(ledgers: T[], gen: number) {
  return ledgers.find((l) => l.generation === gen)
}

export function sumLedgers(ledgers: Array<{ amountKrw: bigint }>): bigint {
  return ledgers.reduce((s, l) => s + l.amountKrw, 0n)
}
