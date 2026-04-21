---
name: commerce-api-build
description: NestJS + PostgreSQL + Prisma 기반 커머스 백엔드 모듈 설계 시 반드시 사용. (1) backend-engineer가 `apps/api/` 스캐폴딩 시, (2) 상품/카트/주문/결제/환불 도메인 모듈 구현 시, (3) 포트원 결제 서버검증과 Webhook 처리 시, (4) OpenAPI 스펙 발행 및 공유 타입 생성 시 사용.
---

# Commerce API Build — NestJS 커머스 백엔드 설계

NestJS + Prisma + PostgreSQL 기반 커머스 도메인 API. 레퍼럴 엔진은 `referral-engine` 스킬 참조.

## 디렉토리 구조

```
apps/api/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── common/
│   │   ├── decorators/
│   │   ├── filters/             # exception filter
│   │   ├── guards/              # auth guard
│   │   └── pipes/               # zod validation pipe
│   ├── modules/
│   │   ├── auth/                # 세션/JWT
│   │   ├── user/                # 회원 (ci 유일, referrer 체인)
│   │   ├── product/
│   │   ├── cart/
│   │   ├── order/               # 주문 생성 + 레퍼럴 트리거
│   │   ├── payment/             # 포트원 결제 검증
│   │   ├── referral/            # 레퍼럴 엔진(별도 스킬 참조)
│   │   ├── payout/              # 정산 배치
│   │   └── webhook/             # 포트원 Webhook 수신
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   └── queue/                   # BullMQ workers
├── test/
└── package.json
```

## 핵심 모듈 설계

### 1. Prisma 스키마 (일부)

```prisma
// prisma/schema.prisma
datasource db { provider = "postgresql"; url = env("DATABASE_URL") }
generator client { provider = "prisma-client-js" }

model User {
  id              String   @id @default(cuid())
  ci              String   @unique           // 본인인증 연계정보 (암호화 저장)
  nickname        String
  referrerId      String?
  referrer        User?    @relation("Referral", fields: [referrerId], references: [id])
  referees        User[]   @relation("Referral")
  referralCode    String   @unique
  status          UserStatus @default(ACTIVE)
  createdAt       DateTime @default(now())

  orders          Order[]
  ledgers         ReferralLedger[] @relation("Beneficiary")

  @@index([referrerId])
}

enum UserStatus { ACTIVE SUSPENDED BANNED }

model Product {
  id          String @id @default(cuid())
  name        String
  priceKrw    BigInt              // 원 단위 정수
  stock       Int
  status      ProductStatus @default(ON_SALE)
  createdAt   DateTime @default(now())
}

enum ProductStatus { ON_SALE SOLD_OUT HIDDEN }

model Order {
  id             String   @id @default(cuid())
  userId         String
  user           User     @relation(fields: [userId], references: [id])
  items          OrderItem[]
  totalAmountKrw BigInt
  status         OrderStatus @default(PENDING)
  paymentId      String?  @unique          // 포트원 paymentId
  createdAt      DateTime @default(now())
  confirmedAt    DateTime?
  refundedAt     DateTime?

  ledgers        ReferralLedger[]
}

enum OrderStatus { PENDING PAID CONFIRMED CANCELED REFUNDED PARTIAL_REFUNDED }

model OrderItem {
  id         String  @id @default(cuid())
  orderId    String
  order      Order   @relation(fields: [orderId], references: [id])
  productId  String
  quantity   Int
  priceKrw   BigInt          // 주문 시점 가격 스냅샷
}

model ReferralLedger {
  id                  String   @id @default(cuid())
  orderId             String
  order               Order    @relation(fields: [orderId], references: [id])
  beneficiaryUserId   String
  beneficiary         User     @relation("Beneficiary", fields: [beneficiaryUserId], references: [id])
  generation          Int                          // 1|2|3
  amountKrw           BigInt                       // EARN은 +, REVERT는 -
  type                LedgerType
  createdAt           DateTime @default(now())

  @@unique([orderId, beneficiaryUserId, generation, type])
  @@index([beneficiaryUserId, createdAt])
}

enum LedgerType { EARN REVERT }

model Payout {
  id           String @id @default(cuid())
  userId       String
  periodStart  DateTime
  periodEnd    DateTime
  amountKrw    BigInt
  status       PayoutStatus @default(PENDING)
  processedAt  DateTime?

  @@unique([userId, periodStart, periodEnd])
}

enum PayoutStatus { PENDING PAID WITHHELD FAILED }

model AbuseLog {
  id         String @id @default(cuid())
  userId     String?
  kind       String     // SELF_REFERRAL | CIRCULAR | DUPLICATE_CI | RATE_LIMIT
  detail     Json
  createdAt  DateTime @default(now())
}
```

**중요 원칙:**
- 금액은 모두 `BigInt` (원 단위 정수). `Decimal`/`Float` 금지
- `ReferralLedger.UNIQUE(orderId, beneficiaryUserId, generation, type)` — 이중 지급·이중 역정산 방지
- `ci` 컬럼은 앱 레벨 암호화(KMS) 후 저장

### 2. Auth 모듈

- 세션 쿠키 + JWT access token 병용 (웹/앱 동시 지원)
- 본인인증은 포트원 API로 `identityVerificationId` 조회 → `ci` 검증 → `User.ci`에 암호화 저장
- 이미 존재하는 `ci`면 재가입 차단 → `AbuseLog(kind='DUPLICATE_CI')`

### 3. Product / Cart / Order 모듈

- 카트는 Redis or DB(User 1:1 Cart) — 세션 지속 여부에 따라
- 주문 생성 = Pending Order + 포트원 결제 요청 → 프론트가 결제위젯 호출

### 4. Payment 모듈 (핵심)

**주문 승인 흐름:**

```
[프론트] PortOne.requestPayment → paymentId 발급
    ↓
[프론트] 성공 콜백 → POST /api/orders/:id/confirm { paymentId }
    ↓
[백엔드] Payment.confirm(orderId, paymentId)
    1. 포트원 서버 API로 paymentId 조회 (GET /payments/:id)
    2. 금액 검증: portone.amount === order.totalAmountKrw
    3. 상태 검증: portone.status === 'PAID'
    4. 트랜잭션 시작
       a. Order.status = PAID
       b. Order.paymentId = paymentId
       c. ReferralEngine.distribute(orderId)  // 원장 3개 생성
    5. 커밋
```

**핵심 코드 스니펫:**

```ts
@Injectable()
export class PaymentService {
  constructor(
    private prisma: PrismaService,
    private portone: PortOneClient,
    private referral: ReferralEngineService,
  ) {}

  async confirm(orderId: string, paymentId: string) {
    const order = await this.prisma.order.findUniqueOrThrow({ where: { id: orderId } })
    if (order.status !== 'PENDING') throw new ConflictException('Order not pending')

    // 1. 포트원 서버 검증
    const payment = await this.portone.getPayment(paymentId)
    if (payment.status !== 'PAID') throw new BadRequestException('Payment not paid')
    if (BigInt(payment.amount.total) !== order.totalAmountKrw) {
      throw new ConflictException('Amount mismatch')
    }

    // 2. 트랜잭션: 주문 승인 + 레퍼럴 배분
    return this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: { status: 'PAID', paymentId },
      })
      await this.referral.distribute(tx, orderId)
      return { ok: true }
    }, { isolationLevel: 'Serializable' })
  }
}
```

### 5. Webhook 모듈 (포트원 이벤트 수신)

- 포트원 Webhook은 `/webhook/portone`로 POST
- `x-portone-signature` 서명 검증 필수
- Idempotency: `(paymentId, eventType, eventTimestamp)` 기준 중복 처리 방지
- 가상계좌 입금완료, 결제취소 등의 비동기 이벤트 처리

### 6. Refund 흐름

```ts
// 전체 환불
async refundFull(orderId: string) {
  return this.prisma.$transaction(async (tx) => {
    await this.portone.cancelPayment(order.paymentId, { reason })
    await tx.order.update({
      where: { id: orderId },
      data: { status: 'REFUNDED', refundedAt: new Date() },
    })
    await this.referral.revert(tx, orderId)  // 기존 원장의 역정산 생성
  })
}
```

## 에러 핸들링

- 모든 예외는 `@Catch()` 글로벌 필터로 표준 응답 포맷: `{ code, message, details? }`
- 400/401/403/404/409/422/500 표준 사용
- 레퍼럴 배분 실패는 주문 승인 실패로 전파 (트랜잭션 롤백)

## OpenAPI 발행 & 공유 타입

- `@nestjs/swagger`로 `/api-docs` 자동 생성
- `pnpm run generate:types` 스크립트로 OpenAPI → zod 스키마 변환 → `packages/shared-types/`에 배포
- 프론트는 `shared-types`를 의존해 런타임 검증

## 환경 변수

```
DATABASE_URL=postgresql://...
PORTONE_STORE_ID=store-...
PORTONE_API_SECRET=...
PORTONE_V2_WEBHOOK_SECRET=...
KMS_KEY_ID=...
JWT_SECRET=...
REDIS_URL=redis://...
```

비밀키는 절대 코드/레포에 포함 금지. `.env.example`만 커밋.

## 체크리스트

- [ ] Prisma 스키마 생성 및 첫 마이그레이션
- [ ] 금액 컬럼 모두 `BigInt`
- [ ] `User.ci` UNIQUE + 암호화
- [ ] `ReferralLedger` UNIQUE 제약
- [ ] 포트원 결제 서버검증 로직
- [ ] Webhook 서명 검증 + idempotency
- [ ] 환불 → 레퍼럴 역정산 연동
- [ ] OpenAPI 스펙 자동 생성 + 공유 타입 배포
- [ ] `.env.example` 제공, 실제 `.env`는 gitignore
