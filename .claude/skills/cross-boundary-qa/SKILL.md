---
name: cross-boundary-qa
description: 커머스+레퍼럴 하네스의 경계면(API↔Frontend, FE↔Native, 백엔드↔포트원) 교차 검증 시 반드시 사용. (1) qa-integrator가 각 모듈 완성 직후 incremental QA 수행 시, (2) 레퍼럴 금액 재계산/정합성 검증 시, (3) 포트원 결제·본인인증 흐름 end-to-end 검증 시, (4) 셀프레퍼럴/순환참조/다중계정 어뷰징 시나리오 재현 시 사용.
---

# Cross-Boundary QA — 경계면 교차 검증 방법론

"엔드포인트가 200으로 응답한다"는 것은 시작이고, 응답 shape이 소비자(프론트/다른 서비스)의 기대와 일치해야 비로소 통합 성공이다.

## 핵심 원칙

1. **Boundary Pair 검증** — 반드시 두 쪽을 동시에 읽는다
   - API 핸들러 ↔ 프론트 hook
   - DB 원장 ↔ 화면 표시 금액
   - 포트원 응답 ↔ 백엔드 검증 로직
2. **Incremental** — 각 모듈(상품/카트/주문/결제/레퍼럴)이 완성되는 즉시 검증, 마지막 일괄 검증 금지
3. **스크립트 실행 필수** — 검증 스크립트를 `scripts/qa/`에 작성하여 반복 실행. 본 QA 에이전트는 `general-purpose` 타입이므로 스크립트 실행 가능
4. **구조적 보고** — 이슈는 증상/재현/로그/원인가설/관련파일 5섹션으로 일관

## QA 수행 흐름

```
1. 검증 대상 모듈 수신 ([backend→qa] module X completed)
   ↓
2. Boundary Pair 식별 → 경계의 양쪽 소스 파일 모두 읽기
   ↓
3. 체크리스트(references의 7 패턴) 적용
   ↓
4. 검증 스크립트 실행 (scripts/qa/)
   ↓
5. 결과 구조화 보고 → _workspace/04_qa_report.md 섹션 추가
   ↓
6. 이슈 발견 시 해당 에이전트에 태그
```

## 검증 매트릭스 (모듈 × 검증 항목)

| 모듈 | 주요 검증 항목 |
|------|---------------|
| Auth / 본인인증 | 포트원 `identityVerificationId` → `ci` 획득 경로, `ci` UNIQUE 제약, 암호화 저장 |
| Product | API 응답 shape = 프론트 `Product` 타입, 금액 `BigInt` 직렬화 처리 |
| Cart | 다중 상품 합계 일치, 재고 소진 시 메시지 |
| Order | 주문 생성 → Pending 상태, `paymentId` 발급 |
| Payment | 포트원 서버검증 호출, 금액 불일치 시 거절, Webhook idempotency |
| Referral | **정확히 3개 원장**, 각 세대 금액 = 주문액 × bps / 10000, 합계 25% |
| Refund | `REVERT` 원장 생성, 순액 = EARN - REVERT 일치 |
| Admin | `AbuseLog` + `AuditLog` 2종 기록, 관리자 행위 추적 |

## 기준 시나리오 (요구사항 §3 직접 인용)

> 3대 유저 D가 1,000,000원 발생 시 C=30,000 / B=50,000 / A=170,000

### E2E 테스트 스크립트 (scripts/qa/referral-1m-test.ts)

```ts
async function main() {
  // 1) 4명 시드 (A → B → C → D 체인)
  const A = await createUser({ ci: 'testA' })
  const B = await createUser({ ci: 'testB', referrerId: A.id })
  const C = await createUser({ ci: 'testC', referrerId: B.id })
  const D = await createUser({ ci: 'testD', referrerId: C.id })

  // 2) D가 1,000,000원 주문
  const order = await createOrder({ userId: D.id, amountKrw: 1_000_000n })

  // 3) 포트원 모의 결제 → confirm
  await confirmOrder(order.id, { mockPaymentId: 'mock_paid' })

  // 4) 검증
  const ledgers = await getReferralLedgers(order.id)
  assertEqual(ledgers.length, 3, '원장은 정확히 3개')
  assertEqual(findGen(ledgers, 1).beneficiaryUserId, C.id, '1대 = C')
  assertEqual(findGen(ledgers, 1).amountKrw, 30_000n, '1대 = 30,000원')
  assertEqual(findGen(ledgers, 2).beneficiaryUserId, B.id, '2대 = B')
  assertEqual(findGen(ledgers, 2).amountKrw, 50_000n, '2대 = 50,000원')
  assertEqual(findGen(ledgers, 3).beneficiaryUserId, A.id, '3대 = A')
  assertEqual(findGen(ledgers, 3).amountKrw, 170_000n, '3대 = 170,000원')
  assertEqual(sumLedgers(ledgers), 250_000n, '합계 = 25%')

  // 5) UI 경계 검증: 레퍼럴 대시보드 GET 응답 shape
  const dashA = await fetch(`/api/referral/dashboard?userId=${A.id}`).then(r => r.json())
  assertSchema(dashA, DashboardSchema)
  assertEqual(dashA.generations.find(g => g.level === 3).amountKrw, 170_000, 'A 대시보드 3대 수익 표시')
}
```

### 환불 시나리오 (scripts/qa/refund-revert-test.ts)

```ts
// 위 시나리오 이어서
await refundOrder(order.id)  // 전체 환불

const afterLedgers = await getReferralLedgers(order.id)
assertEqual(afterLedgers.filter(l => l.type === 'REVERT').length, 3, 'REVERT 3개')
assertEqual(sumLedgers(afterLedgers), 0n, '순액 = 0')
```

## 어뷰징 시나리오 재현

### 셀프레퍼럴 차단
```ts
const A = await createUser({ ci: 'sameCi' })
await expectRejection(
  createUser({ ci: 'sameCi', referrerId: A.id }),
  { status: 409, reason: 'DIRECT_SELF_REFERRAL' }
)
```

### 순환참조 차단
```ts
const A = await createUser({ ci: 'A' })
const B = await createUser({ ci: 'B', referrerId: A.id })
// A의 추천인을 B로 설정 시도 → A는 B의 ancestor이므로 순환
await expectRejection(
  updateReferrer({ userId: A.id, newReferrerId: B.id }),
  { reason: 'CIRCULAR' }
)
```

### 다중계정 경고
```ts
// 동일 IP·디바이스에서 연속 가입
for (let i = 0; i < 5; i++) {
  await createUser({ ci: `multi${i}`, ip: '1.2.3.4', deviceFp: 'dev1' })
}
const reviews = await getUnderReviewUsers()
expectGreaterThan(reviews.length, 0, '수동 심사 플래그 발생')
```

## Boundary Pair 검증 예시

### API ↔ Frontend 타입 불일치 탐지

```ts
// scripts/qa/boundary-shape-check.ts
import { z } from 'zod'
import { ProductSchema } from 'packages/shared-types'

const res = await fetch('/api/products/123')
const raw = await res.json()

// shared-types의 zod 스키마로 런타임 검증
const parsed = ProductSchema.safeParse(raw)
if (!parsed.success) {
  report({
    severity: 'P0',
    symptom: 'API 응답 shape이 공유 스키마와 불일치',
    diff: parsed.error.issues,
    affectedFiles: [
      'apps/api/src/modules/product/product.controller.ts',
      'packages/shared-types/src/product.ts',
      'apps/web/components/commerce/ProductCard.tsx',
    ],
  })
}
```

## 이슈 보고 템플릿

```markdown
### [P0] 3대 레퍼럴 금액 반올림 오차

**증상**
주문액 1,111,111원일 때 3대 수익이 188,888원이어야 하나 188,887원으로 기록됨 (차이 1원)

**재현 절차**
1. D 사용자로 1,111,111원 주문
2. confirmOrder 호출
3. ReferralLedger 조회

**로그/데이터**
```
expected: 188_888n
actual:   188_887n
```

**원인 가설**
`BigInt * 1700n / 10000n` 연산에서 내림 처리. 정책 확정 필요(올림/내림/반올림).

**관련 파일**
- `apps/api/src/modules/referral/referral-engine.service.ts:L42`
- `_workspace/01_analyst_requirements.md#반올림-규칙`
```

## 검증 스크립트 디렉토리

```
scripts/qa/
├── setup-fixtures.ts         # 4대 체인 A→B→C→D 시드
├── referral-1m-test.ts       # 기준 시나리오
├── refund-revert-test.ts     # 환불 역정산
├── abuse-self-referral.ts
├── abuse-circular.ts
├── abuse-multi-account.ts
├── payment-mismatch.ts       # 포트원 금액 불일치 거절
├── boundary-shape-check.ts   # 모든 엔드포인트 × 공유 스키마 매칭
└── run-all.ts                # 위 전부 순차 실행
```

## 체크리스트

- [ ] Boundary Pair 7패턴(`references/boundary-bug-patterns.md`) 모두 적용
- [ ] 기준 시나리오(1,000,000원) E2E 통과
- [ ] 환불 역정산 순액 0 검증
- [ ] 어뷰징 3종 차단 확인
- [ ] API 응답 shape × 공유 zod 스키마 매칭
- [ ] 모든 이슈가 5섹션 템플릿으로 보고됨

## 참고

- 경계면 버그 7패턴: `references/boundary-bug-patterns.md`
