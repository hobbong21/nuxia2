---
name: referral-engine
description: 3세대 레퍼럴 엔진(1대 3%·2대 5%·3대 17% = 합계 25%)을 구현할 때 반드시 사용. (1) backend-engineer가 레퍼럴 트리 스키마 설계 시, (2) 주문 승인 시 배분 계산 및 `ReferralLedger` 기록 시, (3) 환불/부분환불의 역정산(REVERT) 구현 시, (4) 셀프레퍼럴/순환참조/다중계정 어뷰징 방지 로직 구현 시, (5) 정산(Payout) 배치 구현 시 사용.
---

# Referral Engine — 3세대 레퍼럴 분배 엔진

계층형 추천 트리에서 하위 유저의 주문 시 상위 3세대까지 각각 3% / 5% / 17% (합계 25%)를 배분한다.

**배분 규칙 (절대 변경 금지):**
- **1대(Direct)** = 구매자의 직상위 추천인 → **3%**
- **2대(Level 2)** = 1대의 추천인 → **5%**
- **3대(Level 3)** = 2대의 추천인 → **17%**
- **4대 이상** = 배분 없음

## 트리 저장 방식 (선택)

상세한 스키마/쿼리 예시는 `references/tree-schema.md` 참조.

| 방식 | 장점 | 단점 | 권장 상황 |
|------|------|------|-----------|
| **Adjacent List** (referrerId FK) | 간단, 기본 Prisma 모델 | 3세대 조회 JOIN 3회 | MVP, 트리 작음 |
| **Materialized Path** (path 문자열) | 조회 1회 | 쓰기 시 path 유지 복잡 | 읽기 많고 쓰기 적음 |
| **PostgreSQL `ltree`** | 전용 인덱스, 유연한 조회 | 확장 설치 필요 | 대규모, 트리 조회 빈번 |

**기본 권장:** Adjacent List + 재귀 CTE. MVP에 충분. 확장 시 `ltree`로 마이그레이션.

## 배분 계산 알고리즘

```ts
// modules/referral/referral-engine.service.ts
import { PrismaClient, Prisma } from '@prisma/client'

const GENERATIONS = [
  { gen: 1, bps: 300 },    // 3% = 300 basis points
  { gen: 2, bps: 500 },    // 5%
  { gen: 3, bps: 1700 },   // 17%
]

@Injectable()
export class ReferralEngineService {
  async distribute(tx: Prisma.TransactionClient, orderId: string) {
    const order = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { user: true },
    })

    // 1) 상위 3세대 조회 (재귀 CTE)
    const ancestors = await tx.$queryRaw<Array<{ id: string; gen: number }>>`
      WITH RECURSIVE chain AS (
        SELECT id, "referrerId", 1 AS gen
          FROM "User"
         WHERE id = ${order.userId}
        UNION ALL
        SELECT u.id, u."referrerId", c.gen + 1
          FROM "User" u
          JOIN chain c ON u.id = c."referrerId"
         WHERE c.gen < 4
      )
      SELECT "referrerId" AS id, gen
        FROM chain
       WHERE "referrerId" IS NOT NULL
         AND gen BETWEEN 1 AND 3
       ORDER BY gen
    `

    // 2) 각 세대별 금액 계산 및 원장 기록
    for (const { id: beneficiaryUserId, gen } of ancestors) {
      const rule = GENERATIONS.find((r) => r.gen === gen)!
      const amount = (order.totalAmountKrw * BigInt(rule.bps)) / 10000n

      if (amount <= 0n) continue

      // 상태 확인: 수혜자가 SUSPENDED/BANNED면 보류
      const beneficiary = await tx.user.findUniqueOrThrow({
        where: { id: beneficiaryUserId },
      })
      if (beneficiary.status !== 'ACTIVE') continue

      await tx.referralLedger.create({
        data: {
          orderId,
          beneficiaryUserId,
          generation: gen,
          amountKrw: amount,
          type: 'EARN',
        },
      })
    }
  }

  async revert(tx: Prisma.TransactionClient, orderId: string, ratio: number = 1.0) {
    // ratio = 1.0 (전체 환불) | 0.5 (50% 부분환불)
    const earns = await tx.referralLedger.findMany({
      where: { orderId, type: 'EARN' },
    })
    for (const e of earns) {
      const revertAmount = (e.amountKrw * BigInt(Math.round(ratio * 10000))) / 10000n
      await tx.referralLedger.create({
        data: {
          orderId,
          beneficiaryUserId: e.beneficiaryUserId,
          generation: e.generation,
          amountKrw: -revertAmount,     // 음수
          type: 'REVERT',
        },
      })
    }
  }
}
```

**핵심 구현 포인트:**
1. **정수 연산**: `BigInt * bps / 10000` — 소수 오차 방지
2. **재귀 CTE `gen < 4`**: 정확히 3세대까지만
3. **상태 필터**: `status != 'ACTIVE'` 이면 해당 세대 건너뜀 (건너뛴 세대는 손실, 하위 세대로 승계 안 함)
4. **트랜잭션 내부 실행**: Order.status 전환과 단일 트랜잭션
5. **UNIQUE 제약**: `(orderId, beneficiaryUserId, generation, type)`로 이중 지급 방지

## 환불 시나리오

### 전체 환불
```ts
await prisma.$transaction(async (tx) => {
  await portone.cancelPayment(order.paymentId, { reason })
  await tx.order.update({ where: { id: orderId }, data: { status: 'REFUNDED' } })
  await referral.revert(tx, orderId, 1.0)
})
```

원장 효과: `EARN(+30,000)` + `REVERT(-30,000)` → 수혜자의 순액 = 0

### 부분 환불 50%
```ts
await referral.revert(tx, orderId, 0.5)
```

원장 효과: `EARN(+30,000)` + `REVERT(-15,000)` → 순액 = 15,000

### 구매확정 후 환불 금지 정책
주문이 `CONFIRMED` 상태이고 `confirmedAt`이 7일 경과 → 환불은 가능하되 레퍼럴 **역정산 생략**.

## 정산(Payout)

- 주기: 월 1회 (익월 10일)
- 대상: 해당 월의 `ReferralLedger` 순액 합계가 최소 지급액(예: 10,000원) 이상
- 유보: 어뷰징 의심 플래그가 있는 계정은 `WITHHELD` 상태
- 세금: 3.3% 원천징수 (소득세 3% + 지방소득세 0.3%)

```ts
async calculatePayout(userId: string, periodStart: Date, periodEnd: Date) {
  const sum = await prisma.referralLedger.aggregate({
    where: {
      beneficiaryUserId: userId,
      createdAt: { gte: periodStart, lt: periodEnd },
    },
    _sum: { amountKrw: true },
  })
  return sum._sum.amountKrw ?? 0n
}
```

## 어뷰징 방지

상세 구현은 `references/abuse-prevention.md` 참조.

**요약:**
- 셀프레퍼럴: 가입 시 `ci` 중복 검사
- 순환참조: 가입 시 재귀 CTE로 ancestor 체인에 자기 자신 포함 여부 확인
- 다중계정: `ci` UNIQUE + IP/디바이스 지문 점수
- 봇 구매: 레이트 리밋 + 본인인증 완료 여부

## 기준 시나리오 (요구사항 §3에서 직접 인용)

> 3대 유저 D가 1,000,000원 수익 발생 시:
> - C (D의 1대): 30,000원 (3%)
> - B (D의 2대): 50,000원 (5%)
> - A (D의 3대): 170,000원 (17%)

이 시나리오는 `qa-integrator`의 필수 테스트 케이스이며, `cross-boundary-qa` 스킬에서 재사용된다.

## 테스트 어설션 (qa-integrator 활용)

```ts
// 단위 테스트
test('1,000,000원 주문 시 3세대에 각각 3/5/17% 배분', async () => {
  const order = await createTestOrder({ amountKrw: 1_000_000n, by: userD })
  await confirmOrder(order.id)

  const ledgers = await prisma.referralLedger.findMany({
    where: { orderId: order.id, type: 'EARN' },
    orderBy: { generation: 'asc' },
  })

  expect(ledgers).toHaveLength(3)
  expect(ledgers[0]).toMatchObject({ generation: 1, amountKrw: 30_000n })
  expect(ledgers[1]).toMatchObject({ generation: 2, amountKrw: 50_000n })
  expect(ledgers[2]).toMatchObject({ generation: 3, amountKrw: 170_000n })
  expect(ledgers.reduce((s, l) => s + l.amountKrw, 0n)).toBe(250_000n)  // 25%
})
```

## 체크리스트

- [ ] 재귀 CTE로 3세대까지 정확히 조회
- [ ] 배분 금액은 `BigInt * bps / 10000`로 계산
- [ ] 원장 UNIQUE 제약 존재
- [ ] 비활성 수혜자 건너뜀 처리
- [ ] 환불 시 `REVERT` 원장 생성, 순액 검증
- [ ] 어뷰징 방지 3종(셀프/순환/다중계정) 구현
- [ ] 기준 시나리오 테스트 통과

## 참고

- 트리 스키마 비교 및 재귀 CTE 예제: `references/tree-schema.md`
- 어뷰징 방지 구현 상세: `references/abuse-prevention.md`
