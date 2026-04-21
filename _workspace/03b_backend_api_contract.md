# 03b. Backend API Contract — Nuxia Commerce × 3-Generation Referral

> 작성자: `backend-engineer`
> 서버: NestJS 10 + Prisma 5 + PostgreSQL + PortOne V2 SDK
> 금액은 모두 **원 단위 정수**(`BigInt`), JSON 직렬화 시 문자열(`"250000"`)로 전달.
> 모든 시각은 ISO-8601 UTC.

---

## 0. 공통 규약

### 0.1 Base URL
- `https://api.nuxia.example.com/api`

### 0.2 인증
- `Authorization: Bearer <JWT>` (JWT 만료 기본 2h, refresh 14d)
- 공용 엔드포인트(상품 목록, Webhook) 제외 전부 요구

### 0.3 응답 표준
성공: HTTP 2xx + JSON body.
실패: HTTP 4xx/5xx + `{ code, message, details? }`.

### 0.4 BigInt 직렬화
응답 JSON 안에서 금액 필드는 **문자열**. 예: `"totalAmountKrw": "1000000"`.

---

## 1. 엔드포인트 목록

| # | Method | Path | Auth | 요약 |
|---|--------|------|------|------|
| **Auth** |
| 1 | POST | `/auth/signup` | public | 회원가입 (CI 검증 + 셀프/순환/탈퇴쿨다운 차단) |
| 2 | POST | `/auth/login` | public | 이메일+비밀번호 로그인 |
| **User** |
| 3 | GET | `/users/me` | JWT | 내 프로필 (ci/phone 마스킹) |
| 4 | POST | `/users/me/withdraw` | JWT | 탈퇴 (status=WITHDRAWN) |
| **Product** |
| 5 | GET | `/products?q&category&cursor&limit` | public | 상품 목록(커서 페이징) |
| 6 | GET | `/products/:id` | public | 상품 단건 |
| **Cart** |
| 7 | GET | `/cart` | JWT | 내 카트 조회 |
| 8 | POST | `/cart/items` | JWT | 카트 항목 upsert |
| 9 | DELETE | `/cart/items/:productId` | JWT | 카트 항목 삭제 |
| 10 | DELETE | `/cart` | JWT | 카트 비우기 |
| **Order** |
| 11 | POST | `/orders` | JWT | 주문 생성 (PENDING_PAYMENT) |
| 12 | GET | `/orders` | JWT | 내 주문 목록 |
| 13 | GET | `/orders/:id` | JWT | 주문 상세 |
| 14 | POST | `/orders/:id/confirm-receipt` | JWT | 구매확정 (DELIVERED→CONFIRMED) |
| **Payment** |
| 15 | POST | `/payments/orders/:orderId/confirm` | JWT | PortOne 재검증 + 레퍼럴 배분 |
| **Referral** |
| 16 | GET | `/referral/dashboard` | JWT | 총액·유보·이번 달 수익 요약 |
| 17 | GET | `/referral/tree` | JWT | 본인 서브트리(3뎁스) |
| 18 | GET | `/referral/ledger?cursor&limit` | JWT | 원장 내역 |
| **Webhook** |
| 19 | POST | `/webhooks/portone` | public(HMAC) | PortOne 이벤트 수신 |
| **Admin** |
| 20 | GET | `/admin/abuse-logs` | ADMIN | 어뷰징 로그 필터 조회 |
| 21 | POST | `/admin/users/:id/mark-staff` | ADMIN | STAFF/STAFF_FAMILY 지정 |
| 22 | POST | `/admin/users/:id/suspend` | ADMIN | 계정 정지 |
| 23 | POST | `/admin/users/:id/release-minor` | ADMIN | T7 미성년 수동 해제 |
| 24 | POST | `/admin/payouts/run` | ADMIN | 월 정산 실행 |
| 25 | POST | `/admin/payouts/:id/release` | ADMIN | WITHHELD → PAID 이관 |

---

## 2. DTO 정의 (TypeScript + zod)

### 2.1 `POST /auth/signup`

```ts
import { z } from 'zod'

export const SignupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(100),
  nickname: z.string().min(1).max(40),
  referralCode: z.string().optional(),
  ci: z.string().min(1),              // 포트원 본인인증 완료 후 서버가 받은 plaintext ci
  dateOfBirth: z.string().optional(), // ISO date
  phoneNumber: z.string().optional(),
  deviceFingerprint: z.string().optional(),
})
```

**Response 200:**
```json
{
  "user": { "id": "ck…", "email": "a@b.c", "nickname": "홍길동", "role": "CUSTOMER", "status": "ACTIVE", "referralCode": "AB12CD34", "ancestorPath": ["u1","u2","u3"] },
  "accessToken": "eyJhbGc…"
}
```

**Errors:**
| code | status | 설명 |
|------|--------|------|
| `USER_CI_DUPLICATE` | 409 | 동일 `ci` 재가입 시도 (A3) |
| `WITHDRAW_REJOIN_COOLDOWN` | 409 | 탈퇴 30일 쿨다운 (T5) |
| `REFERRAL_NOT_FOUND` | 400 | 추천 코드 미존재 |
| `REFERRAL_SELF_FORBIDDEN` | 400 | 본인/조상 셀프 레퍼럴 (A1) |
| `STAFF_REFERRAL_FORBIDDEN` | 403 | STAFF/STAFF_FAMILY 추천 시도 (T6) |
| `REFERRAL_CYCLE_DETECTED` | 409 | 순환 참조 (A2) |

### 2.2 `POST /auth/login`

```ts
export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})
```

### 2.3 `POST /orders`

```ts
export const CreateOrderSchema = z.object({
  items: z.array(z.object({
    productId: z.string(),
    quantity: z.number().int().min(1),
  })).min(1),
  pointUsedKrw: z.union([z.string(), z.number()]).optional(),   // JSON BigInt: string
  discountKrw:  z.union([z.string(), z.number()]).optional(),
  shippingAddress: z.any().optional(),
})
```

**Response 200:**
```json
{
  "id": "ck...",
  "status": "PENDING_PAYMENT",
  "totalAmountKrw": "100000",
  "items": [ { "productId": "...", "productNameSnapshot": "…", "unitPriceKrw": "50000", "quantity": 2 } ]
}
```

### 2.4 `POST /payments/orders/:orderId/confirm`

```ts
export const ConfirmPaymentSchema = z.object({
  paymentId: z.string().min(1),   // PortOne V2 paymentId
})
```

**Response 200:**
```json
{ "ok": true, "order": { "id": "...", "status": "PAID", "paymentId": "pay_..." }, "referral": { "created": 3, "skipped": 0 } }
```

**Errors:**
| code | status | 설명 |
|------|--------|------|
| `ORDER_NOT_FOUND` | 404 | 주문 없음 / 소유자 불일치 |
| `ORDER_NOT_PENDING` | 409 | 상태가 PENDING_PAYMENT 아님 |
| `PAYMENT_NOT_PAID` | 400 | PortOne status ≠ PAID |
| `AMOUNT_MISMATCH` | 409 | PortOne 금액 ≠ order.totalAmountKrw |

### 2.5 `GET /referral/dashboard`

```ts
interface DashboardResponse {
  totalKrw: string        // "250000"
  pendingKrw: string
  thisMonthKrw: string
}
```

### 2.6 `GET /referral/tree`

```ts
interface TreeResponse {
  userId: string
  nodes: Array<{ id: string; nickname: string; referrer_id: string | null; depth: number }>
}
```

### 2.7 `POST /webhooks/portone`

- **Headers**: `webhook-signature: sha256=<hex>` (or `x-portone-signature`)
- **Body**: PortOne V2 이벤트 JSON
- Idempotent: (paymentId, eventType, eventTimestamp) 유일
- Response: 200 `{ ok: true, duplicate?: true }`

---

## 3. 에러 코드 표준표

| HTTP | code 예시 | 의미 |
|------|-----------|------|
| 400 | `VALIDATION_ERROR` | zod 검증 실패 |
| 400 | `REFERRAL_SELF_FORBIDDEN` | 셀프레퍼럴 |
| 400 | `REFERRAL_NOT_FOUND` | 추천 코드 없음 |
| 400 | `PAYMENT_NOT_PAID` | PortOne 상태 불일치 |
| 400 | `OUT_OF_STOCK` / `EMPTY_CART` / `DISCOUNT_TOO_LARGE` | 주문 생성 오류 |
| 401 | `UNAUTHORIZED` / `INVALID_CREDENTIALS` | 인증 실패 |
| 403 | `FORBIDDEN` / `STAFF_REFERRAL_FORBIDDEN` | 권한 부족 |
| 404 | `NOT_FOUND` / `ORDER_NOT_FOUND` / `PRODUCT_NOT_FOUND` / `USER_NOT_FOUND` | 리소스 없음 |
| 409 | `CONFLICT` / `UNIQUE_CONSTRAINT` | 제약 위반 |
| 409 | `USER_CI_DUPLICATE` | ci 중복 |
| 409 | `WITHDRAW_REJOIN_COOLDOWN` | T5 쿨다운 |
| 409 | `REFERRAL_CYCLE_DETECTED` | A2 순환 |
| 409 | `ORDER_NOT_PENDING` / `AMOUNT_MISMATCH` | 결제 전환 불가 |
| 422 | `UNPROCESSABLE` | 의미상 처리 불가 |
| 429 | `RATE_LIMITED` | 레이트 리밋 |
| 500 | `INTERNAL_ERROR` | 서버 오류 |

---

## 4. 상태 머신

### 4.1 Order

```
                                             ┌── CANCELED
                                             │
PENDING_PAYMENT ──(confirm)──▶ PAID ──▶ PREPARING ──▶ SHIPPED ──▶ DELIVERED ──(7d|manual)─▶ CONFIRMED
                │                              │             │            │                    │
                │                              ▼             ▼            ▼                    ▼
                └── timeout → CANCELED      REFUNDED   PARTIAL_REFUNDED  REFUNDED          (T2) REFUNDED/PARTIAL_REFUNDED*
                                                                                              * lateRefund=true → ledger 역정산 skip
```

### 4.2 User

```
  signup          admin suspend         admin resume
──────────▶ ACTIVE ◀─────────▶ SUSPENDED ──────▶ ACTIVE
             │                 │
             │   dob<19        │ MINOR_HOLD ──(admin releaseMinor)──▶ ACTIVE
             │                 │
             │   score≥70      │ UNDER_REVIEW ──(admin review)──▶ ACTIVE|BANNED
             │                 │
             │   withdraw      │
             └────────────▶ WITHDRAWN (30d cooldown, then new account only)
```

### 4.3 ReferralLedger

```
EARN: PENDING ── (month close + payout) ──▶ PAID
            │
            └─ (admin hold) ──▶ SUSPENDED_FOR_REVIEW
            │
            └─ (refund) ──▶ REVERT row created (+amount 그대로, REVERT row amount=-)

REVERT: CONFIRMED (final)
```

---

## 5. PortOne 연동 시퀀스

### 5.1 결제 승인 (주문 확정)

```
Client                Server                 PortOne
  │ requestPayment ─────────────────────────▶ 
  │                                          결제 위젯
  │ ◀──────────────── paymentId ─────────────
  │ POST /orders (PENDING_PAYMENT) ──▶ Server
  │                                          
  │ POST /payments/orders/:id/confirm { paymentId }
  │                ───────────▶ 
  │                                 GET /payments/:paymentId ──▶
  │                                 ◀── { status: PAID, amount: { total: N } }
  │                                 트랜잭션 시작 (Serializable)
  │                                   1) Order.status = PAID
  │                                   2) ReferralEngine.distribute(tx, orderId)
  │                                      → ReferralLedger rows (gen 1/2/3)
  │                                 커밋
  │ ◀───────────── { ok, referral:{created:3} }
```

### 5.2 Webhook (비동기 재확인)

```
PortOne ──(POST webhook)──▶ /webhooks/portone
                              1) HMAC(SHA-256) verify with PORTONE_WEBHOOK_SECRET
                              2) WebhookEvent.create(UNIQUE: source,externalId,eventType,eventTimestamp)
                                 - 중복이면 P2002 → { ok, duplicate:true }
                              3) dispatch (주로 관찰 목적; confirm은 client-side가 이미 수행)
                              4) processedAt 업데이트
```

### 5.3 본인인증

- 클라이언트에서 PortOne identity-verification 위젯 → `identityVerificationId` 획득
- 클라이언트 `/auth/signup` 호출 시 본인인증 결과로 서버가 받은 **plaintext ci** 를 바디에 포함
- 서버는 `ci` → `encryptCi()` 로 저장, `hashCi()` 를 UNIQUE 검증 키로 사용
- 향후 보강: 서버가 PortOne identity-verification API로 `identityVerificationId` 를 재조회하여 `ci`/생년월일 직접 파싱 (프론트 신뢰 제거)

---

## 6. OpenAPI Export 계획

1. NestJS `@nestjs/swagger` 로 `/api-docs` 및 `/api-docs-json` 자동 생성 — `apps/api/src/main.ts` 에서 이미 설정 완료
2. 빌드 스텝: `pnpm --filter @nuxia/api exec nest build` 후 부팅 → `curl http://localhost:4000/api-docs-json > openapi.json`
3. 프론트/SDK 재사용: `openapi-zod-client` 등을 써서 `packages/shared-types/` 에 zod 스키마 + 타입 생성
4. CI에서 openapi.json diff 검출 → API 하위호환 변경 감시

---

## 7. 검증 가능한 예시 데이터

### 7.1 기준 시나리오 (요구사항 §2.0)

A→B→C→D 체인, D 가 1,000,000원 주문 확정 시:

| beneficiary | generation | rateBps | amountKrw |
|-------------|------------|---------|-----------|
| C           | 1          | 300     | 30000     |
| B           | 2          | 500     | 50000     |
| A           | 3          | 1700    | 170000    |
| **합계**    |            |         | **250000** |

SQL 시나리오 assertion:
```sql
SELECT SUM("amountKrw") FROM "ReferralLedger"
 WHERE "orderId" = :orderId AND "type" = 'EARN';
-- expected: 250000
```

### 7.2 부분 환불 30%

- pre: EARN (30k, 50k, 170k)
- action: `refundPartial(order, 3000, 'reason')` (ratioBps=3000)
- result: REVERT(-9000, -15000, -51000), 합계 순 = 175,000

---

## 8. 변경 이력

| 날짜 | 항목 |
|------|------|
| 2026-04-21 | 초안 작성 — backend-engineer |
