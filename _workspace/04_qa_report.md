# 04. QA Report v1 (2026-04-21)

> 작성자: `qa-integrator`
> 스킬: `cross-boundary-qa` (7패턴 체크리스트)
> 입력: `01_analyst_requirements.md`, `01a_policy_confirmations.md`, `02_designer_spec.md`, `03a_frontend_impl.md`, `03b_backend_api_contract.md`, `03b_abuse_prevention.md`, 실제 코드(`apps/api`, `apps/web`, `packages/shared-types`)
> 수행 방식: **정적 교차 분석** (양쪽 소스 파일 동시 Read → 불일치 보고). 런타임 실행 없음.

---

## 요약

- **P0: 9건** / **P1: 6건** / **P2: 3건** (총 18건)
- **블로커(P0):** 다수 — API 계약과 공유 스키마 간 드리프트, 서명되지 않은 인증 플로우, 대시보드 집계 버그
- **기준 시나리오(1,000,000원):** **PASS** (계산식 상 정확히 30k/50k/170k)
- **어뷰징 6종:** **6/6 PASS** (A1-direct, A1-ancestor, A2, A3, T5, T6 모두 가드 존재)
- **CLEAR 여부:** **NOT CLEAR** — P0 9건을 backend/frontend/analyst에 태그해서 해결 루프 필요

---

## 검증 매트릭스 (모듈 × 항목 × 결과)

| 모듈 | 항목 | 결과 | 이슈 |
|------|------|------|------|
| Auth / Signup | FE→BE 계약 (body 필드) | **FAIL** | [P0-01] |
| Auth / Signup | BE→FE 응답 (refreshToken) | **FAIL** | [P0-02] |
| Auth / Signup | ci 비노출 | PASS | — |
| Referral Engine | 기준 1M원 시나리오 | **PASS** | — |
| Referral Engine | 반올림 (floor) | PASS | — |
| Referral Engine | 1원 건너뛰기 | PASS | — |
| Referral Dashboard | 공유 스키마 shape | **FAIL** | [P0-03] |
| Referral Dashboard | 이번 달 경계 KST | **FAIL** | [P0-04] |
| Referral Dashboard | totalKrw 정의(REVERT 포함) | **FAIL** | [P1-01] |
| Referral Tree | FE 기대 shape vs BE 응답 | **FAIL** | [P0-05] |
| Payment | 금액 재검증 (BigInt) | PASS (주의) | [P1-02] 관찰 |
| Payment | confirm 엔드포인트 경로 | **FAIL** | [P0-06] |
| Payment | Webhook 서명 | PASS (조건부) | [P1-03] |
| Payment | PortOne cancelPayment BigInt→Number | **WARN** | [P1-04] |
| Payout | 원천징수 330bps floor | PASS | — |
| Order 생성 | 응답에 paymentId 포함 | **FAIL** | [P0-07] |
| Order 상태 | enum (CANCELED vs CANCELLED) | **FAIL** | [P0-08] |
| Product | discountPct 캐시/스키마 | **FAIL** | [P1-05] |
| Product | UUID 가정 vs cuid 실제 | **FAIL** | [P0-09] |
| Shape / ApiError | FE parse vs BE response | PASS | — |
| Shape / BigInt | 직렬화 규약 | PASS | — |
| Security / JWT | dev-secret fallback | **WARN** | [P1-06] |
| Security / ci 로깅 | 평문 ci evidence 미기록 | PASS | — |
| Security / WebhookEvent UNIQUE | 스키마 제약 | PASS | — |
| 접근성 | safe-bottom | PASS | — |
| 접근성 | 3중 인코딩 (셀프레퍼럴) | PASS | — |
| 접근성 | 터치 44px | PASS (TabBar는 경계) | [P2-01] |
| 정책 | withholdingBps mismatch (payouts page) | **FAIL** | [P2-02] |
| 정책 | T2 lateRefund cutoff — confirmedAt 없을 때 | **WARN** | [P2-03] |

---

## 발견 이슈

### [P0-01] Signup 요청 바디 필드 불일치 — FE `identityVerificationId` ↔ BE `ci` plaintext

**소유자:** frontend (+ analyst 정책 재확정 필요)

**증상**
`packages/shared-types/src/user.ts::SignupRequestSchema`는 `identityVerificationId: string` 을 요구하지만, 백엔드 `apps/api/src/modules/auth/auth.controller.ts::SignupSchema` 는 `ci: string.min(1)` (본인인증 plaintext ci)을 요구한다. 프론트가 백엔드에 제출할 수 없는 계약.

또한 `03b_backend_api_contract.md §5.3` 에는 "향후 보강: 서버가 PortOne identity-verification API 재조회로 ci 직접 파싱"이라고만 적혀 있으나 실제 구현은 **프론트가 plaintext ci 를 body 에 넣는 것을 요구**. 프론트 계약은 반대 전제(`ci` 프론트 노출 금지).

**재현 절차**
1. `apps/web/app/(auth)/signup/page.tsx::onSubmit` 이 `api.post('/auth/signup', ..., AuthResponseSchema)` 호출한다고 가정
2. Body: `{ email, password, nickname, identityVerificationId: ivId, referralCode }` (shared-types 규약)
3. NestJS `ZodValidationPipe(SignupSchema)` — `ci` 필드 없음 → `VALIDATION_ERROR` 400

**로그/데이터**
```
FE 전송: { identityVerificationId: "iv_abc", ... }  (shared-types SignupRequest)
BE 기대: { ci: "실제ci", ... }                      (auth.controller SignupSchema)
```

**원인 가설**
계약 문서(§5.3)는 "프론트는 identityVerificationId만 전달 → 서버가 PortOne API로 ci 재조회"를 최종 방향으로 명시했으나 구현은 "프론트가 plaintext ci 직접 전달" 버전에 머무름. shared-types 는 문서 방향을 반영.

**관련 파일**
- `apps/api/src/modules/auth/auth.controller.ts:7-17` (`SignupSchema`: `ci` 필수)
- `apps/api/src/modules/auth/auth.service.ts:12` (`ci: string  // plaintext from identity-verification flow`)
- `packages/shared-types/src/user.ts:44-53` (`SignupRequestSchema`: `identityVerificationId` 필수)
- `apps/web/app/(auth)/signup/page.tsx:53` (TODO 상태, `ivId` 만 보유)
- `_workspace/03b_backend_api_contract.md:286-292`

**제안 수정 (backend)**
```ts
// apps/api/src/modules/auth/auth.controller.ts
export const SignupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(100),
  nickname: z.string().min(1).max(40),
  referralCode: z.string().optional(),
  identityVerificationId: z.string().min(1), // ← ci 대신
  deviceFingerprint: z.string().optional(),
})

// auth.service.ts 의 signup()은 identityVerificationId 로
// PortOne identity-verification API 를 호출하여 ci / dateOfBirth / phone 획득
```

**RESOLUTION (backend-engineer, 2026-04-21):**
- 수정 파일: `apps/api/src/modules/auth/auth.controller.ts`, `apps/api/src/modules/auth/auth.service.ts`, 신규 `apps/api/src/modules/auth/identity.client.ts`, `apps/api/src/modules/auth/auth.module.ts`
- 변경 요약: `SignupSchema` 의 `ci` 필드 제거 → `identityVerificationId` 필수. `AuthService.signup()` 이 `IdentityVerificationClient.get(id)` 로 포트원 재조회하여 ci/birthDate/phoneNumber 획득. ci 는 여전히 `encryptCi`/`hashCi` 로 `User.ci`/`User.ciHash` 저장만 되고 프론트/로그에 노출되지 않음.
- 검증 assertion: FE 가 shared-types `SignupRequestSchema` 로 보낸 body 가 ZodValidationPipe 를 통과. 가입 후 응답이 shared-types `AuthResponseSchema` 통과.
- 상태: RESOLVED

---

### [P0-02] AuthResponse — `refreshToken` 없음 / `user.identityVerified`, `user.age` 누락

**소유자:** backend

**증상**
`shared-types/user.ts::AuthResponseSchema` 는 `{ accessToken, refreshToken, user: UserSchema }` 를 요구. 백엔드는 `{ user: redactUser(user), accessToken }` 만 반환 (refreshToken 없음).
또한 `UserSchema` 는 `identityVerified: boolean`, `age: number|null` 필드를 요구하지만 백엔드 `redactUser` 는 DB User 레코드의 나머지를 그대로 스프레드 → 이 두 필드 없음. 프론트 zod 파싱이 `SCHEMA_MISMATCH` 로 실패.

**재현 절차**
1. FE가 `api.post('/auth/signup', payload, AuthResponseSchema)` 호출
2. BE 응답: `{ user: {...passwordHash 제외...}, accessToken: "..." }`
3. `AuthResponseSchema.safeParse` → `refreshToken` 없음으로 실패 → `ApiClientError(code: 'SCHEMA_MISMATCH')`

**로그/데이터**
```
expected keys: accessToken, refreshToken, user
actual  keys: accessToken, user
expected user keys: ..., identityVerified, age
actual  user keys: ..., role, status (no identityVerified, no age)
```

**원인 가설**
- 리프레시 토큰 기능 미구현 (`Session` 모델은 스키마에 존재하나 발급 로직 부재)
- `redactUser` 가 원 DB row 를 내려줘 새 shared-types 필드를 채우지 못함

**관련 파일**
- `apps/api/src/modules/auth/auth.service.ts:37-40` (accessToken만 반환)
- `apps/api/src/modules/auth/auth.service.ts:78-81` (redactUser)
- `packages/shared-types/src/user.ts:24-66`

**제안 수정 (backend)**
```ts
// auth.service.ts
return {
  user: {
    ...redactUser(user),
    identityVerified: !!user.ciHash,
    age: user.dateOfBirth ? calcAge(user.dateOfBirth) : null,
  },
  accessToken: this.issueAccessToken(user.id, user.role),
  refreshToken: await this.issueRefreshToken(user.id), // 세션 레코드 생성
}
```

**RESOLUTION (backend-engineer, 2026-04-21):**
- 수정 파일: `apps/api/src/modules/auth/auth.service.ts`, 신규 `apps/api/src/common/util/serialize.util.ts`, `apps/api/src/modules/user/user.service.ts`
- 변경 요약: 응답에 `accessToken` + `refreshToken` + `user` 포함. refreshToken 은 opaque 32-byte base64url, `Session.refreshHash` 로 저장 (TTL = `JWT_REFRESH_TTL`, 기본 14d). 신규 `serializeUser()` 유틸이 passwordHash/ci/ciHash/phoneNumber 제거 + `identityVerified = !!ciHash` + `age = calcAge(dateOfBirth)` 포함. `UserService.getMe()` 도 같은 serializer 를 사용하여 `/users/me` 와 Auth 응답이 동일 shape.
- 검증 assertion: 가입/로그인/me 응답 모두 `AuthResponseSchema` / `UserSchema` 통과.
- 상태: RESOLVED

---

### [P0-03] `GET /referral/dashboard` 응답 shape이 공유 스키마 `DashboardResponseSchema` 와 전혀 다름

**소유자:** backend

**증상**
FE 가 기대하는 `DashboardResponseSchema` (referral.ts:70-103):
```ts
{
  expectedThisMonthKrw, byGeneration: { gen1, gen2, gen3 }, summary: { payable/withheld/reverted + counts }, recent: ReferralLedger[], tree: TreeNode
}
```
실제 BE `dashboard.service.ts::getSummary` 반환:
```ts
{ totalKrw, pendingKrw, thisMonthKrw }
```
완전히 다른 형태. FE `api.post(..., DashboardResponseSchema)` 호출 시 전체 파싱 실패.

**재현 절차**
1. 프론트 `apps/web/app/(referral)/dashboard/page.tsx` 를 mock → 실 API 로 교체
2. `api.get('/referral/dashboard', DashboardResponseSchema)` 호출
3. zod 검증 실패 → `SCHEMA_MISMATCH`

**로그/데이터**
```
actual:   { totalKrw: "250000", pendingKrw: "...", thisMonthKrw: "..." }
expected: { expectedThisMonthKrw, byGeneration: {...}, summary: {...}, recent: [...], tree: {...} }
```

**원인 가설**
FE/디자이너가 요구하는 리치 대시보드(세대별 분해, 유보/역정산 카운트, recent 목록, 트리 루트 포함)가 백엔드에 미구현. `03b_backend_api_contract.md §2.5` 자체도 간단 3필드 version 으로 문서 불일치.

**관련 파일**
- `apps/api/src/modules/referral/dashboard.service.ts:9-32` (getSummary)
- `apps/api/src/modules/referral/referral.controller.ts:13-16`
- `packages/shared-types/src/referral.ts:70-103` (FE 스키마)
- `_workspace/03b_backend_api_contract.md:160-168` (contract 의 얇은 버전)

**제안 수정 (backend)**
`dashboard.service.ts` 를 재작성하여 `DashboardResponseSchema` 와 1:1 매칭. 세대별 aggregate(generation by group), 상태별 카운트, 최근 10건, 트리 루트 포함.

**RESOLUTION (backend-engineer, 2026-04-21):**
- 수정 파일: `apps/api/src/modules/referral/dashboard.service.ts` (전면 재작성)
- 변경 요약: `getSummary()` 가 `expectedThisMonthKrw` (P1-01: 이번 달 EARN-REVERT 순액), `byGeneration.{gen1,gen2,gen3}` (세대별 sum + distinct orderCount), `summary.{payableKrw, withheldKrw, revertedKrw, withheldCount, revertedCount}`, `recent` (최근 10건), `tree` (재귀 루트) 를 한 응답에 반환. 모든 BigInt 는 `.toString()` 직렬화.
- 검증 assertion: FE `DashboardResponseSchema.safeParse` 통과.
- 상태: RESOLVED

---

### [P0-04] Dashboard 월 경계 — KST 기준 아닌 서버 로컬 타임존 `new Date(y, m, 1)`

**소유자:** backend

**증상**
`dashboard.service.ts::startOfMonth` 는 `new Date(d.getFullYear(), d.getMonth(), 1)` 반환 — 서버 **로컬 타임존 기준** 1일 00:00. 요구사항(`03a_frontend_impl.md TODO 6`, `01_analyst_requirements.md`)은 **KST 1일 00:00** 이어야 함. Docker/Linux 컨테이너는 기본 UTC → 월말 23:00 KST 부터 월 초 09:00 KST 까지 "전달 결과"로 잘못 집계.

**재현 절차**
1. 서버 타임존 UTC
2. 2026-05-01 00:30 KST 에 요청 (UTC 로는 2026-04-30 15:30)
3. `startOfMonth` → `2026-04-01 00:00 UTC` (서버 로컬=UTC 월초)
4. 4월 데이터가 "이번 달" 로 집계 — FE 는 5월로 인식

**로그/데이터**
```
now(KST) = 2026-05-01T00:30+09:00
startOfMonth (서버 UTC 로컬) = 2026-04-01T00:00Z  ← 전월
예상 (KST) = 2026-05-01T00:00+09:00 = 2026-04-30T15:00Z
```

**원인 가설**
한국 서비스에서 `new Date(y, m, 1)` 를 아무 가드 없이 사용. 타임존 고정 필요.

**관련 파일**
- `apps/api/src/modules/referral/dashboard.service.ts:20-25` (`createdAt >= startOfMonth(new Date())`)
- `apps/api/src/modules/referral/dashboard.service.ts:69-71` (`startOfMonth`)

**제안 수정 (backend)**
```ts
function startOfMonthKst(d: Date): Date {
  // KST = UTC+9
  const kst = new Date(d.getTime() + 9 * 3600_000)
  const y = kst.getUTCFullYear()
  const m = kst.getUTCMonth()
  // KST 1일 00:00 = UTC 전일 15:00
  return new Date(Date.UTC(y, m, 1) - 9 * 3600_000)
}
```

**RESOLUTION (backend-engineer, 2026-04-21):**
- 수정 파일: `apps/api/src/modules/referral/dashboard.service.ts`
- 변경 요약: `startOfMonthKst()` / `startOfNextMonthKst()` 헬퍼 추가. `Asia/Seoul` 은 DST 가 없어 UTC+9 고정 오프셋 산술로 안전하게 계산 (date-fns-tz 의존 없이). 모든 "이번 달" 쿼리에 `{ gte: monthStart, lt: monthEnd }` 구간을 사용하여 서버 타임존과 무관하게 KST 월 경계 고정.
- 검증 assertion: UTC 컨테이너에서 2026-05-01 00:30 KST 요청 시 5월 집계로 올바르게 분류.
- 상태: RESOLVED

---

### [P0-05] `GET /referral/tree` 응답 구조가 FE 재귀 `TreeNode` 와 불일치 (평탄화 vs 중첩)

**소유자:** backend (또는 frontend 계약 변경)

**증상**
FE `shared-types/referral.ts::TreeNodeSchema` 는 `children: TreeNode[]` 재귀 중첩 + `contributionThisMonthKrw`, `myEarningThisMonthKrw`, `blockedReason`, `referralCode` 등 풍부한 필드 포함.
BE `dashboard.service.ts::getTree` 반환:
```
{ userId, nodes: [{ id, nickname, referrer_id, depth }] }
```
평탄화된 배열. `snake_case`(`referrer_id`) + 필드 누락. 재귀 구조 아님.

**재현 절차**
1. `DashboardResponseSchema` 안의 `tree: TreeNodeSchema` 자리에 bE가 `{userId, nodes}` 넣으면 바로 파싱 실패
2. `ReferralTreeNode.tsx` 도 `node.children.map`, `node.contributionThisMonthKrw` 등을 직접 접근 → 런타임 `undefined.map is not a function`

**로그/데이터**
```
actual:   { userId: "...", nodes: [{id, nickname, referrer_id: string|null, depth: number}] }
expected: TreeNode { userId, nickname, referralCode, generation:0|1|2|3, blockedReason, joinedAt, contributionThisMonthKrw, myEarningThisMonthKrw, children: TreeNode[] }
```

**원인 가설**
BE: "재귀 CTE 결과 그대로 평탄화 반환이 효율적" 관점. FE 디자이너 스펙 §5-7 은 중첩 재귀 트리 (ReferralTreeNode 컴포넌트 재귀 렌더) 요구.

**관련 파일**
- `apps/api/src/modules/referral/dashboard.service.ts:34-51`
- `packages/shared-types/src/referral.ts:36-67`
- `apps/web/components/referral/ReferralTreeNode.tsx:27-96`

**제안 수정 (backend)**
BE에서 CTE 결과를 postprocess하여 트리 중첩 구조로 변환하고 필요한 enrichment(contribution, blockedReason) 수행. 또는 FE 스키마를 평탄화로 바꾸고 FE에서 중첩 변환하도록 계약 협의.

**RESOLUTION (backend-engineer, 2026-04-21):**
- 수정 파일: `apps/api/src/modules/referral/dashboard.service.ts`
- 변경 요약: `getTree()` 가 camelCase 필드의 중첩 트리 (`TreeNodeSchema`) 반환. 재귀 CTE 에서 `referralCode`, `status`, `role`, `createdAt` 까지 함께 조회한 뒤 메모리에서 부모-자식 연결. 깊이 3 유지. `Order.groupBy` 로 이번 달 기여 매출 합산 후 `myEarningThisMonthKrw = contribution × bpsByGen / 10000` 계산. `blockedReason` 은 STAFF/WITHDRAWN/SUSPENDED/BANNED/UNDER_REVIEW 매핑.
- 검증 assertion: FE `TreeNodeSchema` (재귀 lazy) 로 safeParse 통과.
- 상태: RESOLVED

---

### [P0-06] Payment confirm 엔드포인트 경로 불일치 — FE `/payments/confirm` vs BE `/payments/orders/:orderId/confirm`

**소유자:** frontend (+ 계약 확정)

**증상**
FE `checkout/success/page.tsx:37` 는 `api.post('/payments/confirm', { paymentId, orderId }, ...)` 호출.
BE `payment.controller.ts:20` 은 `@Post('orders/:orderId/confirm')` — `/api/payments/orders/:orderId/confirm`.
경로 다름 → 404 `NOT_FOUND`.

**재현 절차**
1. 결제 완료 → `/checkout/success?paymentId=X&orderId=Y` 도착
2. FE 요청: `POST /api/payments/confirm`
3. BE 라우트 미매칭 → 404

**로그/데이터**
```
FE: POST /payments/confirm body={paymentId, orderId}
BE: 라우트 없음 (실제 라우트는 POST /payments/orders/:orderId/confirm body={paymentId})
```

**원인 가설**
BE는 REST 스타일, FE는 body 에 전부 넣는 스타일로 별도 진화.
또한 FE `PaymentConfirmResponseSchema` 는 `{ orderId, status, amountPaidKrw, message? }` 기대. BE 는 `{ ok, order: Order, referral: {created, skipped} }` 반환 — 이것도 [P0]에 준함 (응답 shape 동시 불일치).

**관련 파일**
- `apps/web/app/(shop)/checkout/success/page.tsx:37`
- `apps/api/src/modules/payment/payment.controller.ts:20-27`
- `apps/api/src/modules/payment/payment.service.ts:80-84` (응답)
- `packages/shared-types/src/payment.ts:16-22` (기대)

**제안 수정 (backend 권장)**
BE controller에 얇은 alias 추가:
```ts
@Post('confirm')
confirmByBody(@Req() req, @Body(...) body: { orderId: string, paymentId: string }) {
  return this.svc.confirm(req.user.userId, body.orderId, body.paymentId)
}
```
서비스 반환을 `{ orderId, status: order.status, amountPaidKrw: order.totalAmountKrw.toString(), message }` 로 매핑.

**RESOLUTION (frontend-engineer, 2026-04-21):**
- 수정 파일:
  - `apps/web/app/(shop)/checkout/page.tsx` — `/orders` POST 를 먼저 호출하여 서버에서 `{ orderId, paymentId }` 수신 후, 그 paymentId 로 `PortOne.requestPayment` 호출. 프론트 자체 `order_${uuid}` 생성은 백엔드 미구현 fallback 으로만 남김.
  - `apps/web/app/(shop)/checkout/success/page.tsx` — 엔드포인트를 `/payments/confirm` → `/payments/orders/${orderId}/confirm` 로 정정. 요청 body 를 `{ paymentId, orderId }` → `{ paymentId }` 로 축소 (orderId 는 path). 응답은 기존 `PaymentConfirmResponseSchema` 로 검증.
- 변경 요약: 결제 흐름을 [주문 생성 → 포트원 결제 → confirm] 3단계로 정렬. 서버 발급 paymentId 만 사용.
- 상태: RESOLVED (백엔드가 P0-07 `CreateOrderResponse { orderId, totalAmountKrw, paymentId }` 반환 + confirm 응답을 `PaymentConfirmResponseSchema` 로 래핑하는 작업 완료 시 실 통신 연동 성립)

---

### [P0-07] Order 생성 응답에 `paymentId` 없음 — FE CreateOrderResponse 와 불일치

**소유자:** backend

**증상**
`shared-types/order.ts::CreateOrderResponseSchema` 는 `{ orderId, totalAmountKrw, paymentId: string }` 요구 (paymentId **필수**).
BE `order.service.ts::create` 는 Order row 그대로 반환 (`paymentId: null`, 필드 케이스 `id` 이며 `orderId` 아님).
FE 흐름: 주문 생성 → paymentId 로 포트원 결제위젯 호출인데, 이 시점에 paymentId 가 없으니 FE 체크아웃이 `paymentId = 'order_${uuid}'` 로 로컬 생성 (checkout/page.tsx:37). **결국 DB `Order.paymentId` 는 confirm 시에야 채워짐** — FE가 로컬 생성한 paymentId와 BE 가 저장하는 paymentId 사이 synchronization 이 없음.

**재현 절차**
1. FE POST /orders → BE는 orders row 반환 (`id=xxx`, `paymentId=null`)
2. FE zod `CreateOrderResponseSchema.safeParse` → `paymentId` 누락으로 실패
3. 현재 코드는 mock 상태라 catch 없이 직접 `crypto.randomUUID()` 로 paymentId 생성 → 추적 불가

**로그/데이터**
```
CreateOrderResponseSchema expects: { orderId, totalAmountKrw, paymentId }
BE returns (order.service.ts:54-76):  Order(id, userId, totalAmountKrw:BigInt, paymentId:null, status, ...)
```

**원인 가설**
`03b_backend_api_contract.md §2.3` 응답 예시도 `{ id, status, totalAmountKrw, items }` — paymentId 없음. 문서-스키마 모두 드리프트.

**관련 파일**
- `apps/api/src/modules/order/order.service.ts:54-76`
- `packages/shared-types/src/order.ts:81-86`
- `apps/web/app/(shop)/checkout/page.tsx:37`
- `_workspace/03a_frontend_impl.md:276` (TODO 5 이미 제기됨)

**제안 수정 (backend)**
```ts
// order.service.ts::create 말미
return {
  orderId: order.id,
  totalAmountKrw: order.totalAmountKrw.toString(),
  paymentId: `order_${order.id}`, // BE가 결정론적으로 생성
}
```
그리고 DB에 저장하여 confirm 시 이 paymentId 재사용.

**RESOLUTION (backend-engineer, 2026-04-21):**
- 수정 파일: `apps/api/src/modules/order/order.service.ts`, `apps/api/src/modules/order/order.controller.ts`
- 변경 요약: `OrderService.create()` 가 `payment_${cuid}` 형식의 paymentId 를 BE 에서 결정론적으로 발급하여 `Order.paymentId` 에 저장 (UNIQUE 제약 유지). 응답은 shared-types `CreateOrderResponseSchema` 와 정확히 일치: `{ orderId, totalAmountKrw, paymentId }`. `PaymentService.confirm()` 에서 body 의 paymentId 가 저장된 값과 일치하지 않으면 400 `PAYMENT_ID_MISMATCH` 반환.
- 추가 반영: `subtotalAmountKrw`, `couponDiscountKrw`, `shippingFeeKrw`, `lineAmountKrw`, `imageUrlSnapshot`, `optionSummary` 컬럼을 Prisma 스키마에 추가하여 shared-types `OrderSchema`/`OrderItemSchema` 와 1:1 매칭. `serializeOrder()` 유틸로 BigInt→string 일관 변환.
- 검증 assertion: FE `CreateOrderResponseSchema.safeParse` 통과. `/orders/:id` 응답 `OrderSchema.safeParse` 통과.
- 상태: RESOLVED

---

### [P0-08] Order 상태 철자 불일치 — schema `CANCELED` vs shared-types `CANCELLED`

**소유자:** backend (schema) 또는 frontend (shared-types)

**증상**
Prisma `schema.prisma::OrderStatus` 에는 `CANCELED` (American, L 1개).
`shared-types/order.ts::OrderStatusSchema` 에는 `CANCELLED` (British, LL 2개).
BE 가 `CANCELED` 를 내려보내면 FE zod 는 enum 에 없어서 실패. 반대도 동일.

**재현 절차**
1. BE `tx.order.update({ status: 'CANCELED' })` 
2. 결과를 FE `OrderSchema.safeParse` → `CANCELED` not in enum → 실패

**로그/데이터**
```
Prisma enum:        PENDING_PAYMENT, PAID, PREPARING, SHIPPED, DELIVERED, CONFIRMED, CANCELED, REFUNDED, PARTIAL_REFUNDED, HOLD
shared-types enum:  ..., CANCELLED, HOLD   (추가로 CANCELLED 한 글자 많음)
```

**원인 가설**
두 개발자가 서로 다른 스펠링 관례로 작성. 문서(`03b_backend_api_contract.md §4.1`)는 `CANCELED` 표기.

**관련 파일**
- `apps/api/prisma/schema.prisma:41-52`
- `packages/shared-types/src/order.ts:4-15`

**제안 수정 (공통)**
모두 `CANCELED` 로 통일 (Prisma가 DB enum을 저장하므로 BE 우선). `shared-types/order.ts` 의 `CANCELLED` → `CANCELED` 로 변경.

**RESOLUTION (backend-engineer, 2026-04-21):**
- 수정 파일: `apps/api/prisma/schema.prisma`
- 변경 요약: Prisma `OrderStatus` enum 을 `CANCELED` → `CANCELLED` (double L) 로 변경, shared-types 와 통일. BE 코드 내 참조 전역 검색 결과 `OrderStatus.CANCELED` 사용 지점 없음(`OrderStatus.PAID`/`REFUNDED`/`PARTIAL_REFUNDED` 등만 사용). PaymentService 의 statusMap 에도 `CANCELLED` 반영.
- 마이그레이션 노트: `prisma migrate dev` 시 PostgreSQL enum rename 필요 (또는 임시 컬럼 우회). 주석 남김.
- 검증 assertion: shared-types `OrderStatusSchema.safeParse('CANCELLED')` 통과.
- 상태: RESOLVED

---

### [P0-09] ID 타입 UUID 가정 vs 실제 cuid — 모든 `z.string().uuid()` 검증 실패

**소유자:** backend (또는 analyst 결정)

**증상**
shared-types 의 거의 모든 모델(`UserSchema.id`, `OrderSchema.id`, `ReferralLedgerSchema.id`, `ProductSchema.id`, `TreeNodeSchema.userId` 등)이 `z.string().uuid()` 로 정의.
실제 Prisma 스키마는 `@default(cuid())` 사용 — cuid 는 `c...` 로 시작하는 25자 영숫자, UUID 가 아님.
→ 모든 응답의 id 필드가 zod 검증 실패 → 전체 API 가 `SCHEMA_MISMATCH` 로 막힘.

**재현 절차**
1. BE가 어떤 엔티티든 응답 (예: `GET /products/:id`)
2. FE `ProductSchema.safeParse` → `id: "ckxxxx..."` 는 `string.uuid()` 통과 못 함
3. FE 에러 바운더리 트리거

**로그/데이터**
```
sample id: "ckvdlr3x8000001...".  (cuid)
zod z.string().uuid() expect: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

**원인 가설**
FE 엔지니어가 UUID 관습을 가정. BE 는 cuid 기본값 선택.

**관련 파일**
- `apps/api/prisma/schema.prisma` (전체 `@default(cuid())`)
- `packages/shared-types/src/user.ts:25` (`id: z.string().uuid()`)
- `packages/shared-types/src/order.ts:19`, `:43`
- `packages/shared-types/src/referral.ts:21-23`, `:38`
- `packages/shared-types/src/product.ts:22`, `:26`

**제안 수정 (frontend)**
`BigIntStringSchema` 처럼 `CuidSchema` 혹은 `IdSchema = z.string().min(1)` 로 정의하고 모든 `.uuid()` 를 치환.

**RESOLUTION (frontend-engineer, 2026-04-21):**
- 수정 파일:
  - `packages/shared-types/src/common.ts` — `IdSchema = z.string().regex(/^c[a-z0-9]{24,}$/)` (cuid 호환) + 타입 `Id` export 추가. append-only 로 기존 코드와 충돌 없음.
  - `packages/shared-types/src/user.ts` — `UserSchema.id/referrerId/ancestorPath` 의 `z.string().uuid()` → `IdSchema`
  - `packages/shared-types/src/order.ts` — `OrderItemSchema.{id,orderId,productId}`, `OrderSchema.{id,userId}`, `CreateOrderRequestSchema.items[].productId`, `CreateOrderResponseSchema.orderId` 전부 `IdSchema`
  - `packages/shared-types/src/referral.ts` — `ReferralLedgerSchema.{id,orderId,beneficiaryUserId}`, `TreeNodeSchema.userId`, `PayoutSchema.{id,userId}` 전부 `IdSchema`
  - `packages/shared-types/src/product.ts` — `ProductSchema.{id,categoryId}`, `ProductListQuerySchema.categoryId` 전부 `IdSchema`
  - `packages/shared-types/src/payment.ts` — `PaymentConfirmRequestSchema.orderId`, `PaymentConfirmResponseSchema.orderId` → `IdSchema`
- 변경 요약: cuid 호환 `IdSchema` 도입 + shared-types 전반 `z.string().uuid()` 치환 (총 18곳).
- 상태: RESOLVED

---

### [P1-01] Dashboard `totalKrw` 정의 혼재 — EARN + REVERT 합 (실제 순액) vs 스펙 "총 지급 예정"

**소유자:** analyst (정의 확정) / backend (구현 정렬)

**증상**
`dashboard.service.ts::getSummary` 의 `totalKrw` 는 beneficiary 전체 `ReferralLedger.amountKrw` 합 (EARN 양수 + REVERT 음수). 정책 및 디자이너 스펙(§5-6 "이번 달 예상 수익")에서 노출되는 "250,000원" 이 어떤 의미인지 문서상 모호.
`DashboardResponseSchema` 의 `expectedThisMonthKrw` 와도 정의가 다를 수 있음.

**관련 파일**
- `apps/api/src/modules/referral/dashboard.service.ts:11-31`
- `_workspace/02_designer_spec.md:405-416`

**제안 수정**
정의 확정: 대시보드 메인 숫자는 **이번 달 EARN - REVERT 순액** 으로 (디자인 기준). `totalKrw` 라는 이름이 누적 총액과 혼동되므로 `netThisMonthKrw` 로 개명 + 스펙(§2.5) 업데이트.

---

### [P1-02] Payment 금액 BigInt 비교 — OK, 그러나 `BigInt(String(...))` 경로 주의

**소유자:** backend (관찰)

**증상**
`payment.service.ts:61` `const portoneTotal = BigInt(String(payment.amount.total))` — PortOne 응답 `amount.total: number|string` 을 안전하게 string 변환 후 BigInt 로 감싸므로 100/1000배 오차 위험 없음. ✅

**주의:** 만약 portone 측이 `amount.total` 에 `1000` 대신 `"1000.00"` 같은 소수 포함 문자열을 반환하면 `BigInt` 가 `SyntaxError` throw. PortOne V2 는 정수원 단위지만 방어적으로 `BigInt(Math.trunc(Number(x)))` 또는 `/^\-?\d+$/` 검증 권장.

**관련 파일**
- `apps/api/src/modules/payment/payment.service.ts:61-67`

**RESOLUTION (backend-engineer, 2026-04-21):**
- 수정 파일: `apps/api/src/modules/payment/payment.service.ts`
- 변경 요약: `parsePortOneTotal(v)` 헬퍼 도입. number 는 `Number.isFinite && Number.isInteger` 통과해야 하고, string 은 `/^-?\d+$/` 만 허용. 소수·NaN·Infinity·객체 모두 `BadRequestException('AMOUNT_INVALID')` 로 거절.
- 상태: RESOLVED

---

### [P1-03] PortOne Webhook 서명 검증 — 코드 존재하지만 `PORTONE_WEBHOOK_SECRET` 미설정 시 항상 거절

**소유자:** backend (DevOps 점검)

**증상**
`portone.webhook.controller.ts:96-104::verifyHmac` 은 `if (!secret) return false` 로 secret 미설정 시 모든 webhook 을 `WEBHOOK_BAD_SIGNATURE` 로 거절. 개발 환경 실수로 묵시적 비활성 안 됨 — 양호한 설계이나 운영에서 env 미설정 시 전체 결제 흐름이 막히는 방향으로 실패. 반대로 **테스트 환경에서 의도된 bypass 필요하면 TEST mode 토글이 없음**.

**관련 파일**
- `apps/api/src/modules/webhook/portone.webhook.controller.ts:39-45`, `:96-104`

**제안**
문서에 `PORTONE_WEBHOOK_SECRET` 필수 env 명시 + staging 환경 전용 모의 bypass 플래그 추가(예: `WEBHOOK_SIGN_VERIFY=strict|permissive`).

**RESOLUTION (backend-engineer, 2026-04-21):**
- 수정 파일: `apps/api/src/modules/webhook/portone.webhook.controller.ts`, `apps/api/.env.example`
- 변경 요약: 기본 동작은 secret 필수 + 서명 검증. `ALLOW_UNSIGNED_WEBHOOK=1` 을 설정하고 `NODE_ENV !== 'production'` 일 때만 bypass 허용. production 에서 ALLOW_UNSIGNED_WEBHOOK 값은 무시. `.env.example` 에 주석 강화.
- 상태: RESOLVED

---

### [P1-04] PortOne `cancelPayment` 에서 `Number(opts.amount)` — 큰 금액 정밀도 손실

**소유자:** backend

**증상**
`portone.client.ts:46` `if (opts.amount != null) body.amount = Number(opts.amount)` — `bigint` → `number` 변환. `Number.MAX_SAFE_INTEGER = 9.0e15` 이므로 KRW 범위 (수조)까지는 안전하지만 기호적 안전장치 없음. 특히 `amount` 가 음수나 0이면 포트원이 다르게 해석할 수 있어 방어적 가드 부재.

**관련 파일**
- `apps/api/src/modules/payment/portone.client.ts:41-60`

**제안**
`amount` 가 주문 총액보다 크면 throw, 0 이하면 throw, 안전범위 체크 후 Number 변환.

**RESOLUTION (backend-engineer, 2026-04-21):**
- 수정 파일: `apps/api/src/modules/payment/portone.client.ts`
- 변경 요약: `coerceAmountToNumber(bigint)` 도입. 0 이하, `MAX_SAFE_INTEGER` 초과, 비정수 모두 `BadRequestException('CANCEL_AMOUNT_INVALID')` 로 거절 후 통과 시에만 `Number()` 변환. `refundFull` 호출(amount 미지정)은 영향 없음.
- 상태: RESOLVED

---

### [P1-05] Product — `discountPct` 파생 컬럼 여부

**소유자:** backend (스키마 보강)

**증상**
shared-types 는 `discountPct: z.number().int().min(0).max(100)` 를 **필수** 필드로 요구하며 주석에 "캐시 컬럼"이라고 명시. Prisma `Product` 모델에는 `priceKrw` 만 있고 `listPriceKrw`, `salePriceKrw`, `discountPct` 모두 없음.

FE는 `listPriceKrw, salePriceKrw, discountPct, brandName, slug, images(ProductImage[]), referralPreviewBps, avgRating, reviewCount` 를 기대하는데, BE DB 는 `priceKrw, stock, category, images(string[])` 만 있음 — **Product 영역 전면 shape drift**.

**관련 파일**
- `apps/api/prisma/schema.prisma:170-188`
- `packages/shared-types/src/product.ts:21-45`

**제안**
Prisma 스키마에 `listPriceKrw BigInt`, `salePriceKrw BigInt`, `discountPct Int @default(0)`, `slug String @unique`, `brandName String?`, `avgRating Decimal`, `reviewCount Int`, `referralPreviewBps Int @default(300)` 추가. `images String[]` → 별도 `ProductImage` 테이블 또는 JSONB.

**RESOLUTION (backend-engineer, 2026-04-21):**
- 수정 파일: `apps/api/prisma/schema.prisma`, `apps/api/src/modules/product/product.service.ts`, `apps/api/src/modules/order/order.service.ts`, `packages/shared-types/src/product.ts`
- 변경 요약: `Product` 모델 확장 — `slug @unique` (기존 `sku` → `slug` 이행), `listPriceKrw`, `salePriceKrw`, `discountPct`, `brandName`, `avgRating`, `reviewCount`, `referralPreviewBps` 추가. `ProductStatus` enum 에 `DRAFT`/`ACTIVE`/`ARCHIVED` 추가. `ProductService.serializeProduct()` 가 `images: string[]` 를 shared-types `ProductImageSchema[]` 형태로 변환. `referralPreviewBps` 기본값은 2500 (25% 합계) 로 shared-types 도 업데이트.
- 마이그레이션 노트: `prisma migrate dev` 시 `priceKrw` → `salePriceKrw` 리네임 + `listPriceKrw` 복사. 기존 `ON_SALE` 행은 `ACTIVE` 로 이행. 스키마 주석에 기재.
- 상태: RESOLVED

---

### [P1-06] JWT_SECRET `dev-secret` 하드코딩 fallback

**소유자:** backend

**증상**
`auth.module.ts:13`, `jwt.strategy.ts:15` 에 `process.env.JWT_SECRET ?? 'dev-secret'`. env 미설정 시 **운영 환경에서도** 기본값 `dev-secret` 으로 JWT 발급·검증 — 모든 세션이 공개 시크릿으로 서명된 상태. 관측성에 경고 없음 → silent prod vulnerability.

**관련 파일**
- `apps/api/src/modules/auth/auth.module.ts:13`
- `apps/api/src/modules/auth/jwt.strategy.ts:15`

**제안**
```ts
const secret = process.env.JWT_SECRET
if (!secret || secret.length < 32) throw new Error('JWT_SECRET must be set (>=32 chars)')
```
Bootstrap 단계에서 검증.

**RESOLUTION (backend-engineer, 2026-04-21):**
- 수정 파일: `apps/api/src/main.ts`, `apps/api/src/modules/auth/auth.module.ts`, `apps/api/src/modules/auth/jwt.strategy.ts`, `apps/api/.env.example`
- 변경 요약: `main.ts::assertRequiredEnv()` 가 `JWT_SECRET`, `DATABASE_URL`, `PORTONE_API_SECRET` 부재 시 즉시 `process.exit(1)` + 로그. `JWT_SECRET` 은 추가로 `length >= 32` 검증. `AuthModule` 및 `JwtStrategy` 내부의 `'dev-secret'` fallback 은 모두 `requireJwtSecret()` 로 교체되어 부재 시 즉시 throw. `.env.example` 에 필수 안내 추가.
- 상태: RESOLVED

---

### [P2-01] TabBar 터치 타겟 — 부모 `h-tabbar (56px)` 에 `tap` 클래스만 기대, 실제 44×44 보장 모호

**소유자:** frontend

**증상**
`TabBar.tsx:31-32` 에서 `<ul>` 가 `h-tabbar` (56px). 각 `<li>` 가 `flex-1` 로 균분. 4개 탭이 360px 화면에서 각 90px 폭이므로 폭은 OK. 다만 탭바 내부의 실 클릭 영역은 `Link` 전체 — 상단 패딩이 2px이므로 실질 높이 54px. WCAG 44×44 통과 여부는 통과하나 버튼 내부 실 터치 지점(아이콘 20px + 라벨 11px)은 중앙에 쏠림. 양호한 수준이지만 `min-h-11 min-w-11` 명시 누락.

**관련 파일**
- `apps/web/components/commerce/TabBar.tsx:38-50`

**제안**
`Link` 에 `min-h-11` 추가 또는 `tap` 유틸이 이미 이를 보장하는지 확인(globals.css 검증 필요).

---

### [P2-02] Payout 페이지 원천징수 계산 예시가 `3.3%` 대신 `floor(gross×330/10000)` 와 다른 근사값

**소유자:** frontend (mock)

**증상**
`app/(mypage)/payouts/page.tsx:18` mock: `gross=250000, tax=8250` — `250000 × 330 / 10000 = 8250` ✅ 정확.
`gross=180000, tax=5940` — `180000 × 330 / 10000 = 5940` ✅ 정확.
(실제로는 PASS. 그러나 현업에서 이게 frozen mock 이라는 설명이 부족해 향후 BE 완성시 숫자 유지 여부 혼란)

**관련 파일**
- `apps/web/app/(mypage)/payouts/page.tsx:4-25`

**제안**
mock 데이터에 주석 "API 연결 시 실제 값은 `applyWithholding()` 출력으로 대체" 명시.

---

### [P2-03] `confirmedAt` 없는 Order 에 `refundFull` 호출 시 lateRefund 판단 누락

**소유자:** backend

**증상**
`payment.service.ts:98-100` `const late = !!order.confirmedAt && Date.now() - order.confirmedAt.getTime() > holdDays*86400000`. `confirmedAt` 이 null (구매확정 전) 이면 `late = false` → 환불 시 정상적으로 `revert()` 호출 → REVERT 생성. 그러나 구매확정 전이면 EARN 자체가 없어야 하므로 reverts 는 모두 skip (earns=빈 배열). 실제 영향 없음 but 이름이 헷갈림. 또한 `confirmedAt` null + `status=PAID`(구매확정 전) 에서 환불 호출 시 `OrderStatus.REFUNDED` 로 전이 — `PREPARING/SHIPPED/DELIVERED` 같은 중간상태에서도 같은 경로를 탈 수 있어 상태머신 위반 가능성.

**관련 파일**
- `apps/api/src/modules/payment/payment.service.ts:91-130`

**제안**
`refundFull` 엔드포인트 가드:
```ts
if (![OrderStatus.PAID, OrderStatus.PREPARING, OrderStatus.SHIPPED, OrderStatus.DELIVERED, OrderStatus.CONFIRMED].includes(order.status))
  throw new ConflictException({ code: 'ORDER_NOT_REFUNDABLE' })
```

---

## 기준 시나리오 검증 (A→B→C→D, D가 1,000,000원)

**정적 분석 (referral-engine.service.ts::distribute):**

입력: `order.totalAmountKrw = 1_000_000n`, 체인 존재 → `getAncestors` CTE 로 `[{gen:1, id:C}, {gen:2, id:B}, {gen:3, id:A}]` 반환.

각 세대에 `floorBps(1_000_000n, bps)`:
- gen=1, bps=300 → `(1_000_000n * 300n) / 10_000n = 30_000n` ✅
- gen=2, bps=500 → `(1_000_000n * 500n) / 10_000n = 50_000n` ✅
- gen=3, bps=1700 → `(1_000_000n * 1700n) / 10_000n = 170_000n` ✅
- sum = 250_000n ✅ (= 25%)

**부가 검증:**
- `111_111n` 입력:
  - gen=1: `111_111 × 300 / 10000 = 33_333.3 → 내림 3_333n`... 계산 재확인: `111_111 × 300 = 33_333_300`, `/ 10000 = 3_333.33 → BigInt 나눗셈은 floor → 3_333n` ✅
  - gen=2: `111_111 × 500 = 55_555_500 / 10000 = 5_555n` ✅
  - gen=3: `111_111 × 1700 = 188_888_700 / 10000 = 18_888n` ✅
  - 절삭 잔액 = `33.3 + 55.5 + 88.7 = 177.5` → 플랫폼 귀속 (정책대로) ✅
- `1n` 입력: 모든 세대 `floorBps(1n, bps)` = 0n → `if (amount <= 0n) skipped++; continue` ✅

**결과: PASS** — 기준 시나리오는 계산식·코드 로직 양쪽 통과.

**참고 우려**: engine.service.ts 라인 26-43 의 CTE 는 `gen BETWEEN 1 AND 3` + `WHERE c.gen < 4` 조건을 사용. 이 CTE는 구매자 자신을 gen=1 로 시작해 `referrerId` 를 타고 올라감. SELECT 시 `"referrerId" AS ancestor_id, gen` 로 **재귀의 "현재 노드에서 본 부모"를 반환**. 즉 `gen=1` 은 구매자의 직접 추천인 → C (1대). ✅ 로직상 off-by-one 없음.

---

## 어뷰징 6종 결과 요약

| # | 시나리오 | 구현 | 판정 |
|---|---------|-----|------|
| 1 | **A1-direct** | `user.service.ts:106 referrer.ciHash === ciHash` → 400 `REFERRAL_SELF_FORBIDDEN` + AbuseLog `SELF_REFERRAL` | ✅ PASS |
| 2 | **A1-ancestor** | `user.service.ts:115-127` — referrer.ancestorPath에서 ciHash 매칭 → 400 `REFERRAL_SELF_FORBIDDEN` + AbuseLog `ANCESTOR_SELF_REFERRAL` | ✅ PASS |
| 3 | **A2 순환참조** | `user.service.ts:164-170` — post-insert `ancestorPath.includes(created.id)` 체크 → 409 `REFERRAL_CYCLE_DETECTED` + AbuseLog `CIRCULAR`. Serializable tx 롤백 | ✅ PASS (방어적, 실제 발생 조건은 제한적) |
| 4 | **A3 다중계정** | `User.ciHash @unique` DB 제약 + `user.service.ts:51-77` 앱 레이어 409 `USER_CI_DUPLICATE` + AbuseLog `DUPLICATE_CI` | ✅ PASS |
| 5 | **T5 탈퇴 30일** | `user.service.ts:53-69` `existing.status === 'WITHDRAWN'` + `withdrawnAt + cooldownDays` 비교 → 409 `WITHDRAW_REJOIN_COOLDOWN` + AbuseLog | ✅ PASS |
| 6 | **T6 STAFF 차단** | `user.service.ts:94-103` `referrer.role ∈ (STAFF, STAFF_FAMILY)` → 403 `STAFF_REFERRAL_FORBIDDEN` + AbuseLog `STAFF_REFERRAL`. 추가로 engine.service.ts:67-70 buyer STAFF 스킵, 86-91 beneficiary STAFF 스킵 | ✅ PASS |

**보조 관찰:**
- A4 레이트 리밋 (ThrottlerModule) — 문서에만 언급, 실제 app.module.ts 정적 확인 범위 밖(Grep 미수행). 존재 여부 가정.
- A5 SWAP — 배치 잡 TODO 상태, 스키마만 준비 (문서 §A5 에서 명시).
- 셀프레퍼럴 가드는 가입 시점에 차단되므로 engine.service.ts 에서 별도 재검사 없음 — 적절.

---

## 검증 통과 항목 (PASS)

- ✅ Referral Engine 기준 1M원 시나리오 계산 정확
- ✅ floorBps / applyWithholding (money.util) — BigInt 나눗셈 내림 동작 정확
- ✅ ci 암호화 저장 (AES-256-GCM) + ciHash HMAC UNIQUE
- ✅ ci plaintext 평문 로깅 없음 (AbuseLog evidence 에는 `ciHash` 만 기록)
- ✅ `redactUser()` 에서 passwordHash/ci/ciHash/phoneNumber 제거 (auth.service.ts:79)
- ✅ `User.ciHash @unique`, `ReferralLedger @@unique(orderId, beneficiaryUserId, generation, type)`, `WebhookEvent @@unique(source, externalId, eventType, eventTimestamp)` 제약 모두 스키마에 존재
- ✅ Prisma serializable isolation (`createUser`, `confirm`, `refundFull/Partial`)
- ✅ `main.ts` BigInt.prototype.toJSON 등록 → `JSON.stringify` 시 string 자동 변환
- ✅ Webhook HMAC 검증 (timing-safe) 구현
- ✅ 셀프레퍼럴 UI 3중 인코딩 (ReferralTreeNode: border-referral-blocked + 🚫 + "차단됨 — 동일 인증정보")
- ✅ `pb-safe` / `env(safe-area-inset-bottom)` — TabBar, TopSheet, checkout 하단 CTA 모두 적용
- ✅ Product 엔드포인트 (controller) 존재, `JwtAuthGuard` 비적용(공개) — 요구사항대로
- ✅ `POST /webhooks/portone` 퍼블릭이지만 HMAC 필수 (controller 설계 적절)
- ✅ Payout withholdingBps=330 default + `applyWithholding` `floor(gross × 330 / 10000)` — 정책 T1 일치
- ✅ ApiError shape `{ code, message, details? }` — exception filter 와 shared-types ApiErrorSchema 정합 (api-client.ts:54-62 정상 파싱)

---

## 수동 테스트 필요 (자동 검증 범위 밖)

- E2E: 포트원 실결제 — 본인인증 위젯 플로우 실환경 검증 (MSW mock만으로는 부족)
- 딥링크 유니버설 링크 (AASA / assetlinks.json 배포 후 실기기 테스트)
- Capacitor 하드웨어 백 버튼 실기기 동작
- Swagger 문서 vs shared-types diff CI 정책
- A4 Throttler 실제 429 응답 (부하 테스트)
- A5 swap 배치 잡 (구현 대기)
- DB migration 실제 적용 + seed 후 `referral-1m-test.ts` 실행
- 접근성: 스크린리더 (VoiceOver / TalkBack) 실기기
- prefers-reduced-motion 실기기 검증

---

## 경계면 버그 7패턴 적용 결과

| 패턴 | 적용 결과 |
|-----|----------|
| 1. Shape Drift | **Heavy** — [P0-01, P0-02, P0-03, P0-05, P0-07, P0-08, P0-09, P1-05] 전체 |
| 2. 단위 불일치 | 약함 — BigInt 단일 진실 OK, 다만 portone.client.ts `Number(opts.amount)` [P1-04] |
| 3. Nullable 오해 | 경계적 — Order.paymentId 여부 [P0-07], confirmedAt null [P2-03] |
| 4. 상태 전이 순서 | 경계적 — CANCELED/CANCELLED 표기 [P0-08], refund 가드 느슨 [P2-03] |
| 5. 이중 진실의 원천 | 경계적 — `totalKrw` 정의 모호 [P1-01] |
| 6. Off-by-N / 세대 경계 | 없음 — `gen BETWEEN 1 AND 3` CTE 정확, 기준 시나리오 PASS |
| 7. 비동기 이벤트 | 양호 — Webhook idempotency UNIQUE, `confirm` 은 client-driven, Webhook 은 observational (best-effort) |

---

## 변경 이력

| 날짜 | 항목 |
|------|------|
| 2026-04-21 | v1 초안 — qa-integrator. 18건(P0×9 / P1×6 / P2×3). 기준 시나리오 PASS, 어뷰징 6/6 PASS, 그러나 API 계약 drift 다수로 CLEAR 아님. |
| 2026-04-21 | v2 재검증 — qa-integrator. P0 9/9 RESOLVED, P1 5/5 RESOLVED, P2 미수정(의도적 연기). 새 경계면 이슈 3건 발견(P1×2, P2×1). 기준/어뷰징/원자성 회귀 없음. **CLEAR (with minor follow-up).** |

---

# QA Report v2 (2026-04-21) — Re-verification after fixes

> 작성자: `qa-integrator`
> 수행: 정적 교차 분석 (v1에서 RESOLUTION 주장된 이슈에 대해 실제 파일 재검증 + 회귀/부작용 점검)

## 재검증 결과 요약

- **P0: 9/9 RESOLVED** — 차단 이슈 전부 해소
- **P1: 5/5 RESOLVED** (P1-01은 analyst 정책 이슈라 v1에서 backend RESOLUTION 대상이 아니었음; 나머지 P1-02/03/04/05/06 모두 RESOLVED)
- **P2: 미처리** — P2-01/02/03 세 건은 v1에서 수정 대상 아님, 여전히 OPEN (non-blocking)
- **회귀 (Regression):**
  - 기준 시나리오(1,000,000원) 정적 계산: **PASS** — `engine.service.ts::distribute` + `GENERATIONS = [300/500/1700]` + `floorBps` 구조 유지. C=30k/B=50k/A=170k.
  - 어뷰징 6/6: **PASS** — `user.service.ts`의 A1-direct/A1-ancestor/A2-cycle/A3-dup-ci/T5-30d/T6-STAFF 가드 모두 존재 (v1 이후 변경 없음).
  - Transaction 원자성: **PASS** — `payment.service.ts::confirm`이 `$transaction(…, Serializable)` 내에서 `order.update` + `referral.distribute` 유지. `refundFull`/`refundPartial` 동일.
  - UNIQUE 제약: **PASS** — `ReferralLedger @@unique([orderId, beneficiaryUserId, generation, type])`, `User.ciHash @unique`, `WebhookEvent @@unique(...)`, `Order.paymentId @unique` 모두 유지.
- **새 경계면 이슈:** 3건 (아래 섹션 "v2 신규 발견" 참조). 두 건은 P1, 한 건은 P2.
- **CLEAR 여부: CLEAR (조건부)** — 18개 v1 이슈는 코드상 전부 해결됨. v2에서 발견된 3건은 런타임 경계 케이스로, Phase 4 통합 릴리스 진입은 가능하되 신규 P1 2건은 릴리스 전 수정 권고.

---

## 검증 매트릭스 v2 (이슈 × 판정)

| # | 제목 | v1 | v2 판정 | 비고 |
|---|------|----|---|------|
| P0-01 | Signup `identityVerificationId` | FAIL | **RESOLVED** | `auth.controller.ts::SignupSchema` 가 `identityVerificationId` 필수. `auth.service.ts::signup` L47에서 `identity.get(id)` 후 `verifiedCustomer.ci` 파싱. `SignupRequestSchema`(shared-types)와 1:1. |
| P0-02 | AuthResponse refresh/identityVerified/age | FAIL | **RESOLVED** | `auth.service.ts` L70-76이 `{accessToken, refreshToken, user: serializeUser(user)}` 반환. `serialize.util.ts::serializeUser` L36-38: `identityVerified: !!u.ciHash`, `age: calcAge(...)` 포함. Session 생성+refreshHash 저장(L114-122). |
| P0-03 | Dashboard shape | FAIL | **RESOLVED** | `dashboard.service.ts::getSummary` 반환 = `{expectedThisMonthKrw, byGeneration.{gen1,gen2,gen3}, summary.{payable/withheld/reverted + counts}, recent[], tree}`. `DashboardResponseSchema`와 1:1. |
| P0-04 | KST 월 경계 | FAIL | **RESOLVED** | `startOfMonthKst()` / `startOfNextMonthKst()` L321-338. `Date.UTC(y, m, 1) - 9*3600_000` 으로 KST 1일 00:00 = UTC 전월 말일 15:00 계산. UTC fallback 없음. |
| P0-05 | Tree 재귀 camelCase | FAIL | **RESOLVED** | `getTree()` L166-234. 반환 객체의 필드 모두 camelCase(`userId`/`nickname`/`referralCode`/`generation`/`blockedReason`/`joinedAt`/`contributionThisMonthKrw`/`myEarningThisMonthKrw`/`children`). 부모-자식 `nodeMap` 연결. `TreeNodeSchema` 1:1. |
| P0-06 | FE confirm 경로 | FAIL | **RESOLVED** | `checkout/success/page.tsx` L38: `/payments/orders/${orderId}/confirm` + body `{paymentId}`. `payment.controller.ts` L20 `@Post('orders/:orderId/confirm')` 일치. 응답 `PaymentConfirmResponseSchema`. |
| P0-07 | 서버 발급 paymentId | FAIL | **RESOLVED** | `order.service.ts::create` L93 `payment_${o.id}` 결정론적 생성 + tx 내 update로 `Order.paymentId` 저장 (@unique 유지). 응답 `{orderId, totalAmountKrw, paymentId}` = `CreateOrderResponseSchema`. FE `checkout/page.tsx` L52-58이 서버 paymentId 사용. (※ L62-63 fallback 경로 주의 — 아래 v2 신규 P1 참조) |
| P0-08 | OrderStatus CANCELLED | FAIL | **RESOLVED** | `schema.prisma` L52 `CANCELLED` (double L). `shared-types/order.ts` L13 `CANCELLED` 동일. Grep 결과 코드 내 `CANCELED`(single L) 잔존 없음 (리포트 텍스트에만 등장). |
| P0-09 | IdSchema 치환 | FAIL | **RESOLVED** | `shared-types/common.ts` L50 `IdSchema = z.string().regex(/^c[a-z0-9]{24,}$/)`. `z.string().uuid()` grep → shared-types/src 아래 0건 (주석만). user/order/referral/product/payment 전반에서 `IdSchema` 사용 확인. |
| P1-02 | `parsePortOneTotal` | OBSERVE | **RESOLVED** | `payment.service.ts` L219-242 `parsePortOneTotal(v)` — number는 `isFinite && isInteger`, string은 `/^-?\d+$/`, 기타 타입은 `BadRequestException('AMOUNT_INVALID')`. 소수/NaN/Infinity/객체 모두 거부. |
| P1-03 | 웹훅 bypass 가드 | WARN | **RESOLVED** | `portone.webhook.controller.ts` L46-47: `ALLOW_UNSIGNED_WEBHOOK === '1' && NODE_ENV !== 'production'` 두 조건 모두 참일 때만 bypass. production에서는 `ALLOW_UNSIGNED_WEBHOOK`=1이어도 거절. `.env.example` L36-37에 주석 있음. |
| P1-04 | `coerceAmountToNumber` | WARN | **RESOLVED** | `portone.client.ts` L68-96. `typeof === 'bigint'` + `amount > 0n` + `amount <= MAX_SAFE_INTEGER` + `Number.isFinite && isInteger` 모두 통과한 경우만 `Number()` 변환. 아니면 `CANCEL_AMOUNT_INVALID`. |
| P1-05 | Product 필드 확장 | FAIL | **RESOLVED** | Prisma `Product` 모델(L181-209)에 `slug @unique`, `listPriceKrw`, `salePriceKrw`, `discountPct`, `brandName`, `avgRating`, `reviewCount`, `referralPreviewBps` 모두 존재. `ProductStatus` enum에 `DRAFT/ACTIVE/SOLD_OUT/HIDDEN/ARCHIVED` — shared-types와 일치. `ProductSchema`와 필드 대응. (※ v2 신규 P2 참조) |
| P1-06 | 환경변수 fail-fast | WARN | **RESOLVED** | `main.ts::assertRequiredEnv()` L17-32이 `JWT_SECRET`/`DATABASE_URL`/`PORTONE_API_SECRET` 부재 시 `process.exit(1)`. `JWT_SECRET.length < 32`도 종료. `auth.module.ts::requireJwtSecret()` + `jwt.strategy.ts::requireJwtSecret()` 에서도 throw. `?? 'dev-secret'` grep = 주석만. |

## 이슈별 판정 상세

### P0-01 Signup identityVerificationId — RESOLVED
**증거:** `apps/api/src/modules/auth/auth.controller.ts` L10-17 (`SignupSchema` 필드 = `email/password/nickname/identityVerificationId/referralCode?/deviceFingerprint?`); `apps/api/src/modules/auth/auth.service.ts` L47-54 (`identity.get(id)` → `verification.verifiedCustomer.ci`); `apps/api/src/modules/auth/identity.client.ts` L33-44 (REST call `GET https://api.portone.io/identity-verifications/{id}`); `user.service.ts` L43-45 (`hashCi`+`encryptCi` 저장).
**잔여 리스크:** `identity.client.ts::apiSecret = process.env.PORTONE_API_SECRET ?? ''` — 이미 `main.ts::assertRequiredEnv`가 부재 시 종료하므로 런타임에는 OK. 다만 identity.client 내 `??  ''` 패턴이 모듈 import 시 평가되므로 테스트 환경에서 주의.

### P0-02 AuthResponse refreshToken / identityVerified / age — RESOLVED
**증거:** `auth.service.ts::signup` L70-76 응답 `{accessToken, refreshToken, user: serializeUser(user)}`. `login` L90-96도 동일 형태. `issueRefreshToken` L109-124에서 opaque 32-byte base64url 생성, `Session.refreshHash`에 sha256 저장, TTL 파싱(`parseTtl`, default 14d). `serialize.util.ts::serializeUser` L26-42에서 passwordHash/ci/ciHash/phoneNumber 제거 + `identityVerified = !!u.ciHash` + `age = calcAge(dateOfBirth)` + `ancestorPath default []` + `payoutEligibility`. `user.service.ts::getMe` L178-184도 동일 serializer 사용 — `/users/me` = `AuthResponse.user` shape.
**잔여 리스크:** 없음 (shared-types `UserSchema` 모든 필드 매칭: id/email/nickname/referralCode/referrerId/ancestorPath/role/status/identityVerified/payoutEligibility/age/createdAt/updatedAt).

### P0-03 Dashboard shape — RESOLVED
**증거:** `dashboard.service.ts::getSummary` L23-126이 한 객체에 모든 필드 반환. 수식 검증:
- `gen1.rateBps: 300 as const`, `gen2.rateBps: 500`, `gen3.rateBps: 1700` — shared-types `z.literal(300|500|1700)` 통과.
- `byGeneration.genN.orderCount` = `findMany({distinct:['orderId']}).length`.
- `summary.revertedKrw` = `|revertSumNeg|` 양수 직렬화. shared-types `BigIntStringSchema`가 음수 문자열도 허용하나, 표시 규약에 맞춰 양수화 — 적절.
- `tree`는 재귀 `TreeNodeSchema` 루트.
**잔여 리스크:** `expectedThisMonthKrw = earnSum + revertSumNeg` — REVERT가 음수로 저장되면 순액이 음수가 될 수 있고 `BigIntStringSchema` 는 `-?\d+` 허용하므로 FE 파싱 OK. 단 UI 표시 시 음수 대응 필요(표시측 책임, OPEN 아님).

### P0-04 KST 월 경계 — RESOLVED
**증거:** `dashboard.service.ts` L321-338 `KST_OFFSET_MS = 9 * 3_600_000`. `startOfMonthKst`는 `now + 9h` → KST clock 획득 → `Date.UTC(y,m,1) - 9h` 로 UTC epoch 산출. 실측:
- `now = 2026-05-01T00:30+09:00 (=2026-04-30T15:30Z)`
- `kst = 2026-05-01T00:30Z` → `y=2026, m=4 (0-indexed May)`
- `Date.UTC(2026,4,1) = 2026-05-01T00:00Z` → `- 9h = 2026-04-30T15:00Z` ✅ (KST 5월 1일 00:00)
- 따라서 `createdAt >= 2026-04-30T15:00Z`가 `5월 집계` — 올바름.
- DST 없는 Asia/Seoul 고정 오프셋이므로 date-fns-tz 없이도 정확.
**잔여 리스크:** 없음.

### P0-05 Tree 재귀 camelCase — RESOLVED
**증거:** `dashboard.service.ts::getTree` L166-234. CTE로 평탄 rows 수집 후 `nodeMap`으로 id→node 생성, 두 번째 루프에서 `parent.children.push(child)`. 반환 `TreeNodeDto` 인터페이스(L265-275)는 `TreeNodeSchema`와 필드/타입 1:1. `generation: 0|1|2|3` 일치, `blockedReason: 'STAFF'|'SUSPENDED'|'WITHDRAWN'|'SELF_REFERRAL'|null` 매핑(L277-286) — 단 `SELF_REFERRAL`은 `deriveBlockedReason`에서 생성되지 않음(셀프레퍼럴은 가입시점에 차단되어 DB에 없으므로 정상). `snake_case` 흔적 없음.
**잔여 리스크:** 없음 (설계상 트리 깊이 3 유지 `WHERE s.depth < 3`).

### P0-06 FE 결제 confirm 경로 — RESOLVED
**증거:** `checkout/success/page.tsx` L37-41: `api.post('/payments/orders/${encodeURIComponent(orderId)}/confirm', { paymentId }, PaymentConfirmResponseSchema)`. `payment.controller.ts` L20 `@Post('orders/:orderId/confirm')` + L24 `ConfirmPaymentSchema = { paymentId: string.min(1) }`. 경로/body/응답 타입 모두 일치.
**잔여 리스크:** L51-55 `.catch(() => { setStatus('success'); clearCart() })` — 백엔드 실패 시에도 성공 UI 표시. 데모 편의용이며 실운영에는 부적절 (아래 v2 신규 P2 참조).

### P0-07 서버 발급 paymentId — RESOLVED
**증거:** `order.service.ts::create` L60-100: `prisma.$transaction` 내 `tx.order.create` 후 `paymentId = 'payment_' + o.id` 생성 → `tx.order.update({data: {paymentId}})` — 같은 tx에서 커밋. `Order.paymentId @unique` 제약(schema.prisma L253). 응답 L103-107 `{orderId, totalAmountKrw, paymentId}` — `CreateOrderResponseSchema` 그대로. `payment.service.ts::confirm` L51-56이 body.paymentId ≠ DB.paymentId 일 때 `PAYMENT_ID_MISMATCH`. FE `checkout/page.tsx` L52-58이 `order.paymentId` 사용(서버값).
**잔여 리스크:** FE L59-64 fallback (`crypto.randomUUID()` + `TEMP_ORDER`) — 아래 v2 신규 P1 참조.

### P0-08 OrderStatus CANCELLED — RESOLVED
**증거:** `schema.prisma` L52 `CANCELLED` (double L) + 주석 L51에 의도 명시. `shared-types/order.ts` L13 동일. `payment.service.ts::buildConfirmResponse` statusMap L98-102에 `CANCELLED` 사용. Grep `CANCELED` 코드 잔존 0건 (리포트/문서/스킬 파일에만 등장).
**잔여 리스크:** `03b_backend_api_contract.md`에 `CANCELED` 텍스트 잔존 (문서-코드 드리프트, non-blocking, 문서 작업).

### P0-09 IdSchema 치환 — RESOLVED
**증거:** `common.ts` L50 `IdSchema = z.string().regex(/^c[a-z0-9]{24,}$/)`. shared-types/src 아래 `z.string().uuid()` grep = 0건 (주석 한 줄만). user.ts/order.ts/referral.ts/product.ts/payment.ts 모두 `import { IdSchema }` 사용 확인.
**잔여 리스크:** `Id` 정규식 `/^c[a-z0-9]{24,}$/` — Prisma cuid 기본 25자(c+24자)이므로 정확히 매칭. Prisma가 cuid2로 교체될 경우(`c` 제거, 24자) 재조정 필요. 현재는 문제 없음.

### P1-02 parsePortOneTotal — RESOLVED
**증거:** `payment.service.ts` L219-242 export 함수. number는 `Number.isFinite && Number.isInteger`, string은 `/^-?\d+$/`, 기타 타입은 `AMOUNT_INVALID` throw. 소수/NaN/Infinity/`{}` 모두 거절. `1000.00` 문자열도 regex 탈락 → 거절.

### P1-03 웹훅 bypass 가드 — RESOLVED
**증거:** `portone.webhook.controller.ts` L46-47 `allowUnsigned = process.env.ALLOW_UNSIGNED_WEBHOOK === '1' && process.env.NODE_ENV !== 'production'`. production에서는 flag=1이어도 `!verifyHmac(...)` 시 `throw` (L52-54).

### P1-04 coerceAmountToNumber — RESOLVED
**증거:** `portone.client.ts` L68-96. 4단 가드: (1) `typeof === 'bigint'`, (2) `> 0n`, (3) `<= MAX_SAFE_INTEGER`, (4) `Number.isFinite && isInteger`. 전부 통과 후에만 `Number()` 리턴. `opts.amount` 미지정 경로(refundFull 일부)는 body에 포함되지 않으므로 영향 없음.

### P1-05 Product 필드 확장 — RESOLVED
**증거:** `schema.prisma::Product` L181-209에 모든 필드 추가. `ProductSchema` (shared-types)와 대조:
| shared-types | Prisma | Match |
|------|------|------|
| id | id cuid | ✓ |
| slug | slug @unique | ✓ |
| name | name | ✓ |
| brandName: nullable | brandName String? | ✓ |
| categoryId: IdSchema.nullable | **category String?** | ⚠ 타입 mismatch (v2 신규 P2) |
| status: ProductStatus enum | status ProductStatus | ✓ |
| listPriceKrw | listPriceKrw BigInt | ✓ |
| salePriceKrw | salePriceKrw BigInt | ✓ |
| discountPct | discountPct Int @default(0) | ✓ |
| stock: int.nullable | stock Int (not null) | ⚠ 경미한 드리프트 (v2 신규 P2) |
| images: ProductImage[]≥1 | images String[] | ✓ (service에서 변환) |
| description | description @default("") | ✓ |
| referralPreviewBps | referralPreviewBps Int? @default(2500) | ✓ |
| avgRating | avgRating Float | ✓ |
| reviewCount | reviewCount Int | ✓ |

### P1-06 환경변수 fail-fast — RESOLVED
**증거:** `main.ts::assertRequiredEnv` L17-32이 bootstrap 최상단 호출. `JWT_SECRET`/`DATABASE_URL`/`PORTONE_API_SECRET` 부재 시 `process.exit(1)` + 로그. `JWT_SECRET.length < 32`도 종료. `auth.module.ts::requireJwtSecret` + `jwt.strategy.ts::requireJwtSecret` 에서도 `throw new Error('JWT_SECRET must be set (>= 32 chars). Aborting.')`. `?? 'dev-secret'` 코드 잔존 0건.

## 회귀 테스트 (v1 PASS 항목)

### 1. 기준 시나리오 (1,000,000원 × C/B/A) — PASS
`engine.service.ts::GENERATIONS` L7-11 그대로 `[{gen:1,bps:300},{gen:2,bps:500},{gen:3,bps:1700}]`. `distribute()` L60-134에서 `floorBps(totalAmountKrw, rule.bps)` 계산:
- gen=1: `(1_000_000n * 300n) / 10_000n = 30_000n` → C
- gen=2: `(1_000_000n * 500n) / 10_000n = 50_000n` → B
- gen=3: `(1_000_000n * 1700n) / 10_000n = 170_000n` → A
- 합계 250,000원 = 25% ✓

### 2. 어뷰징 6종 — 6/6 PASS (변경 없음)
`user.service.ts::createUser` (`$transaction(Serializable)` 내):
- A1 direct: L106 `referrer.ciHash === ciHash` → `REFERRAL_SELF_FORBIDDEN`
- A1 ancestor: L115-127 `referrer.ancestorPath`에서 ciHash 매칭 → `REFERRAL_SELF_FORBIDDEN`
- A2 cycle: L164-170 post-insert `ancestorPath.includes(created.id)` → `REFERRAL_CYCLE_DETECTED`
- A3 dup-ci: L51-77 + DB `User.ciHash @unique` → `USER_CI_DUPLICATE`
- T5 30d: L53-69 `existing.status === 'WITHDRAWN'` + withdrawnAt 경과 비교 → `WITHDRAW_REJOIN_COOLDOWN`
- T6 STAFF: L94-103 `referrer.role ∈ (STAFF, STAFF_FAMILY)` → `STAFF_REFERRAL_FORBIDDEN` + engine.service.ts L67-70/L86-92 추가 방어

### 3. Transaction 원자성 — PASS
- `payment.service.ts::confirm` L77-91: `prisma.$transaction(async (tx) => { tx.order.update(PAID) → referral.distribute(tx, ...) }, { isolationLevel: Serializable })`
- `refundFull` L129-155, `refundPartial` L178-203: 모두 Serializable + `order.update` + `refund.create` + `referral.revert(tx,...)` 동일 tx
- `user.service.ts::createUser` L48-175: Serializable 유지

### 4. UNIQUE 제약 — PASS
- `User.ciHash @unique` (schema L111)
- `ReferralLedger @@unique([orderId, beneficiaryUserId, generation, type])` (L326)
- `WebhookEvent @@unique([source, externalId, eventType, eventTimestamp])` (L419)
- `Order.paymentId @unique` (L253) — 신규 보강(P0-07 해결 과정)
- `User.email @unique`, `User.referralCode @unique`, `Product.slug @unique` 추가 유지

## v2 신규 발견 이슈

### [v2-P1-NEW-01] FE checkout fallback이 비-cuid paymentId / "TEMP_ORDER" orderId 생성 — IdSchema 파싱 실패 리스크
**소유자:** frontend
**증상:** `apps/web/app/(shop)/checkout/page.tsx` L59-64 — `POST /orders` 가 실패하면 `orderId = 'TEMP_ORDER'` + `paymentId = \`order_${crypto.randomUUID()}\`` 로 fallback. 이어서 `success` 페이지로 `orderId=TEMP_ORDER` 전달 → `api.post('/payments/orders/TEMP_ORDER/confirm', ...)` 는 BE에서 `PAYMENT_ID_MISMATCH` 또는 `ORDER_NOT_FOUND`. 더 심각하게는, 만일 FE가 `CreateOrderResponseSchema.safeParse` 로 검증할 경우 `'TEMP_ORDER'` 는 `IdSchema`(`/^c[a-z0-9]{24,}$/`) 불일치로 이미 reject.
**재현:**
1. api.post가 네트워크 오류로 실패
2. catch 블록 진입 → orderId='TEMP_ORDER'
3. success 페이지 confirm 호출 → BE 404
**원인 가설:** v1에서 "데모 편의용 mock" 로 의도적으로 남긴 fallback이지만, v2에서 `IdSchema` 가 엄격해져 FE 내 일관성 깨짐.
**관련 파일:** `apps/web/app/(shop)/checkout/page.tsx:59-64`, `packages/shared-types/src/common.ts:50`
**제안:** catch에서 fallback 대신 toast 에러 + return. 데모용 경로는 별도 `NEXT_PUBLIC_DEMO=1` flag로 분리.
**판정:** **NEW P1** (신규)

### [v2-P1-NEW-02] CreateOrderRequestSchema(shared-types)는 shippingAddress 필수이나 BE/FE 모두 미사용 — contract drift
**소유자:** backend or frontend (계약 확정 필요)
**증상:** `shared-types/order.ts::CreateOrderRequestSchema` L65-79는 `shippingAddress: ShippingAddressSchema`를 **필수**로 요구. BE `order.controller.ts::CreateOrderSchema` L14-29는 `shippingAddress: z.any().optional()`. FE `checkout/page.tsx::createOrderPayload` L43-48은 `shippingAddress` 미전송. 두 계약이 정반대 방향으로 drift.
**재현:** FE가 shared-types `CreateOrderRequestSchema.parse(payload)` 로 클라이언트 validate하면 실패 (shippingAddress missing). 현재 FE는 shared-types parse를 사용하지 않고 직접 전송하므로 런타임은 동작하나, 타입 계약상 drift.
**원인 가설:** P0-07 수정 시 BE가 `.optional()`로 완화했지만 shared-types는 v1 초기 엄격 설계 유지.
**관련 파일:** `packages/shared-types/src/order.ts:65-79`, `apps/api/src/modules/order/order.controller.ts:14-29`, `apps/web/app/(shop)/checkout/page.tsx:43-48`
**제안:** (A) shared-types `CreateOrderRequestSchema.shippingAddress` 를 `.optional()` 로 완화 + UI에서 배송지 입력 구현 전까지 수용, 또는 (B) FE 체크아웃에서 shippingAddress 수집 및 전송. (A) 권장 (현 스프린트 범위).
**판정:** **NEW P1**

### [v2-P2-NEW-03] 기타 소폭 드리프트 (serializeProduct placeholder, checkout success catch 성공 처리 등)
**소유자:** frontend / backend (minor)
**증상:**
- `product.service.ts::serializeProduct` L55-57: 이미지 배열이 비었을 때 `[{ url: '', alt: '' }]` placeholder 추가. 그러나 `ProductImageSchema.url = z.string().url()` 이므로 빈 문자열은 런타임 zod 검증 실패. Prisma `Product.images: String[]` (빈 배열 가능) → shared-types parse 실패 가능.
- `schema.prisma::Product.category: String?` vs `ProductSchema.categoryId: IdSchema.nullable` — BE는 자유 문자열, shared-types는 cuid 요구. 현재 `serializeProduct` L49가 `categoryId: null as string | null` 하드코드라 우회되어 있음(런타임 OK이나 의미상 드리프트).
- `schema.prisma::Product.stock: Int (not null, default 0)` vs `ProductSchema.stock: int.nullable` — BE는 항상 숫자, FE는 null 허용. serializeProduct에서 `stock ?? null` 이지만 not-null이라 항상 숫자 → 드리프트 무해하지만 의미 불일치.
- `checkout/success/page.tsx` L51-55 `.catch(() => { setStatus('success'); clearCart(); })` — 백엔드 오류여도 UI 성공 처리. 데모용이나 실운영 위험.
**영향:** 현재 시드 데이터가 이미지 최소 1장을 채우면 안 나타남. 운영에는 안전 가드 추가 권장.
**관련 파일:** `apps/api/src/modules/product/product.service.ts:43-65`, `apps/web/app/(shop)/checkout/success/page.tsx:51-55`, `apps/api/prisma/schema.prisma:192-197`
**판정:** **NEW P2** (non-blocking)

## 경계면 버그 7패턴 재적용 결과 (v2)

| 패턴 | v1 | v2 |
|-----|----|----|
| 1. Shape Drift | Heavy | **Light** — v1 P0 8건이 해결되어 주요 drift 제거. 신규 drift 2건(v2-P1-NEW-02, v2-P2-NEW-03)은 경미 |
| 2. 단위 불일치 | 약함 | **해소** — `parsePortOneTotal` + `coerceAmountToNumber` 방어 |
| 3. Nullable 오해 | 경계적 | 경계적 — v2-P2-NEW-03의 `stock`/`categoryId` 미세 차이 |
| 4. 상태 전이 | 경계적 | **해소** — CANCELLED 통일, P2-03은 별도 OPEN |
| 5. 이중 진실의 원천 | 경계적 | 경계적 — P1-01 (totalKrw 정의) 여전히 analyst 확정 대기 |
| 6. Off-by-N | 없음 | 없음 |
| 7. 비동기 이벤트 | 양호 | 양호 |

## 다음 액션 권장

- **CLEAR. Phase 4 통합 릴리스 진입 가능.**
- **단, 릴리스 전 수정 권장 (블로커 아님):**
  1. `v2-P1-NEW-01` — checkout fallback 제거 또는 DEMO flag 분리 (frontend)
  2. `v2-P1-NEW-02` — `CreateOrderRequestSchema.shippingAddress` 를 optional 로 완화하거나 FE 배송지 입력 구현 (analyst 방향 확정 후 frontend/backend)
- **추가 연기 가능:**
  - v2-P2-NEW-03 (경미한 Product 필드 드리프트)
  - v1 P1-01 (`totalKrw` 정의 확정 — analyst)
  - v1 P2-01/02/03 (기존 OPEN 유지)
- **마이그레이션 주의:** schema.prisma 변경(OrderStatus CANCELED→CANCELLED, Product 컬럼 추가)은 `prisma migrate dev` 필요. staging에서 우선 실행 후 production 배포.

---

**RESOLUTION v2.1 (2026-04-21):**
- v2-P1-NEW-01: apps/web/app/(shop)/checkout/page.tsx fallback 제거, 에러 토스트로 전환 (엄격 모드). `TEMP_ORDER`/`crypto.randomUUID()` 제거 — IdSchema 위반 차단.
- v2-P1-NEW-02: packages/shared-types/src/order.ts `shippingAddress: ShippingAddressSchema.optional()`. apps/api/src/modules/order/order.controller.ts 의 `z.any().optional()` → 로컬 복제된 `ShippingAddressSchema.optional()` 로 타입 일치 (monorepo import 파이프라인 미연결로 로컬 복제 + 동기화 주석).
- v2-P2-NEW-03:
  - `product.service.ts::serializeProduct` 이미지 placeholder를 `https://placehold.co/600x600?text=No+Image` 로 교체 (빈 문자열 URL 제거, ProductImageSchema.url 통과 확보).
  - shared-types `ProductSchema.categoryId` → `categoryName: z.string().nullable().optional()` 로 변경, `serializeProduct` 가 `p.category` 를 직접 매핑.
  - `checkout/success/page.tsx` catch 분기에서 `setStatus('success')` 제거 → `setStatus('fail')` + 에러 토스트 + 고객센터 안내 + "다시 시도"/"주문 내역" 버튼 추가. `status !== 'PAID'` 도 실패 취급.
