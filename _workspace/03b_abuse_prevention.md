# 03b. Abuse Prevention — 구현 현황 및 검증 가이드

> 작성자: `backend-engineer`
> 대상 시나리오: **A1~A5 + T5 탈퇴 쿨다운** (= 총 6종)
> 기본 정책: **정책 → 검출 → 차단 → 로그** 4단계로 정리. 모든 차단 이벤트는 `AbuseLog` 에 1행 이상 기록된다.

---

## 0. 공통 구성

| 항목 | 파일 |
|------|------|
| Prisma 모델 (AbuseLog, AbuseKind, AbuseAction) | `apps/api/prisma/schema.prisma` |
| PII 암호화 (AES-256-GCM) / 결정적 HMAC | `apps/api/src/common/util/crypto.util.ts` |
| 레이트 리밋 Guard | `@nestjs/throttler` (ThrottlerModule at `apps/api/src/app.module.ts`) — 기본 60s / 120req |

---

## A1. 셀프레퍼럴 (본인이 본인을 추천)

- **정책**: 구매자/신규 가입자의 `ci` 가 추천 체인의 1·2·3대 중 어느 `ci` 와도 일치하면 금지
- **검출**:
  - 가입: `UserService.createUser()`
    - DIRECT: `referrer.ciHash === ciHash` (same tx)
    - ANCESTOR: `referrer.ancestorPath` 의 user 들의 `ciHash` 조회 후 비교
  - 주문 시 추가 검사: `ReferralEngineService.distribute()` 는 beneficiary `status`·`role` 가드로 간접 방어 (셀프는 가입 시점에 이미 차단되었음)
- **차단/로그**:
  - `apps/api/src/modules/user/user.service.ts` → `createUser()` 에서
    - kind=`SELF_REFERRAL` or `ANCESTOR_SELF_REFERRAL`, action=BLOCKED
    - throw `BadRequestException({ code: 'REFERRAL_SELF_FORBIDDEN' })`

**테스트 가능한 assertion**:
1. 동일 ci 로 referrer/self 가입 → HTTP 400 + code=`REFERRAL_SELF_FORBIDDEN`
2. A→B 존재 시, B.ci 로 A 추천인으로 재가입 시도 → 400 + `REFERRAL_SELF_FORBIDDEN`(ANCESTOR)
3. `AbuseLog` 에 `kind=SELF_REFERRAL` 또는 `ANCESTOR_SELF_REFERRAL` 행 1건 이상

---

## A2. 순환참조 (A→B→C→A)

- **정책**: `referrerId` FK + `ancestorPath` 캐시가 DAG를 유지. 가입 후 `ancestorPath` 계산 결과가 자기 자신을 포함하면 롤백.
- **검출**:
  - 가입: `createUser()` 에서 `ancestorPath = [referrer.id, ...(referrer.ancestorPath)].slice(0,3)` 계산 후 `ancestorPath.includes(created.id)` 체크
  - 실제로는 referrer 가 이미 존재하므로 반드시 false, 그러나 방어적 assertion 유지
- **차단/로그**:
  - `apps/api/src/modules/user/user.service.ts` → `createUser()`
    - kind=`CIRCULAR`, action=BLOCKED
    - throw `ConflictException({ code: 'REFERRAL_CYCLE_DETECTED' })`

**테스트 가능한 assertion**:
1. 순환을 유발하는 인위적 시나리오 → 409 + `REFERRAL_CYCLE_DETECTED`
2. 해당 트랜잭션 롤백으로 User row 미생성 확인

---

## A3. 다중계정 (동일 `ci` 다계정)

- **정책**: 1 `ci` = 1 active account.
- **검출**:
  - **1차 (강한 신호)**: `User.ciHash` UNIQUE 제약 — DB 레벨
  - **2차 (점수)**: 향후 구현 예정. 현재 Prisma 스키마에 `AbuseLog.evidence(jsonb)` 로 IP/디바이스 해시를 기록할 수 있도록 구비. 점수화 잡은 TODO.
- **차단/로그**:
  - `apps/api/src/modules/user/user.service.ts` → `createUser()`
    - ciHash 중복이고 status ≠ WITHDRAWN → kind=`DUPLICATE_CI`, action=BLOCKED
    - throw `ConflictException({ code: 'USER_CI_DUPLICATE' })`

**테스트 가능한 assertion**:
1. 동일 ci 2회 가입 → 2번째 요청 409 + `USER_CI_DUPLICATE`
2. DB `SELECT COUNT(*) FROM "User" WHERE "ciHash" = $hash` == 1
3. `AbuseLog.kind='DUPLICATE_CI'` 1건

---

## A4. 봇 구매 / 자동화

- **정책**:
  - 본인인증 완료 계정만 주문 (`ci != NULL`)
  - 레이트 리밋 60s / 120req 기본 (ThrottlerModule, `app.module.ts`)
  - (TODO) Redis 기반 세밀 버킷: `order:rate:{userId}`, `order:rate:{ip}` — BullMQ 쓸 때 같이
- **검출**:
  - ThrottlerGuard 가 엔드포인트 수준에서 차단
  - (TODO) 행동 휴리스틱 (시간차 측정, 카드 BIN 재사용) — 별도 잡
- **차단/로그**:
  - Throttler 는 HTTP 429 `Too Many Requests` 반환
  - (TODO) 임계 도달 시 `AbuseLog(kind='RATE_LIMIT' 또는 'BOT_PATTERN')` 기록 — hook interceptor 필요

**테스트 가능한 assertion**:
1. 동일 IP 에서 60s 내 121번째 요청 → 429

---

## A5. 보상 헌팅 / 리더 지인 상호 구매

- **정책**: 7일 내 buyer ↔ beneficiary 관계가 양방향으로 발생한 주문은 지급 보류
- **검출**: (TODO) 주기적 배치 잡. 쿼리 예:
  ```sql
  WITH swaps AS (
    SELECT a.orderId AS a_order, b.orderId AS b_order
      FROM "ReferralLedger" a
      JOIN "Order" oa ON a."orderId" = oa.id
      JOIN "ReferralLedger" b ON a."beneficiaryUserId" = b."orderId"::? -- 개념 쿼리
     ...
  )
  ```
- **차단/로그**:
  - 매칭된 `ReferralLedger.status = SUSPENDED_FOR_REVIEW` 로 업데이트
  - `AbuseLog(kind='SWAP', evidence={...})` 기록
- **현재 구현 상태**: 스키마 및 상태 enum(`SUSPENDED_FOR_REVIEW`) 준비 완료. 배치 잡은 `apps/api/src/modules/admin` 에 추후 추가.

**테스트 가능한 assertion**:
1. SWAP 시나리오 생성 → 배치 잡 실행 후 `ReferralLedger.status=SUSPENDED_FOR_REVIEW` 인 행 수 ≥ 2

---

## T5. 탈퇴 30일 쿨다운 재가입 차단

- **정책**: `User.status=WITHDRAWN` 인 계정의 `ci` 는 `withdrawnAt + 30d` 이내 재가입 불가
- **검출**:
  - `UserService.createUser()` 에서 ciHash 로 기존 row 조회
  - `existing.status === 'WITHDRAWN' && (now - withdrawnAt) < cooldownDays` 면 차단
- **차단/로그**:
  - kind=`WITHDRAW_REJOIN_COOLDOWN`, action=BLOCKED
  - throw `ConflictException({ code: 'WITHDRAW_REJOIN_COOLDOWN' })`

**테스트 가능한 assertion**:
1. 가입 → 탈퇴 (`/users/me/withdraw`) → 즉시 동일 ci 재가입 시도 → 409 + `WITHDRAW_REJOIN_COOLDOWN`
2. 30일 경과 모의(withdrawnAt 조작) 후 재가입 → 200 (새 계정, referrerId=신규)

---

## 로깅 정책 (`AbuseLog` 스키마 + 기록 조건)

```prisma
model AbuseLog {
  id               String      @id @default(cuid())
  kind             AbuseKind
  severity         Int         @default(3)  // 1~5
  primaryUserId    String?
  relatedUserIds   String[]
  relatedOrderIds  String[]
  evidence         Json
  action           AbuseAction @default(LOGGED)
  detectedAt       DateTime    @default(now())
}

enum AbuseKind {
  SELF_REFERRAL
  ANCESTOR_SELF_REFERRAL
  CIRCULAR
  DUPLICATE_CI
  STAFF_REFERRAL
  WITHDRAW_REJOIN_COOLDOWN
  RATE_LIMIT
  BOT_PATTERN
  SWAP
  MULTI_ACCOUNT
}
enum AbuseAction { LOGGED BLOCKED HELD SUSPENDED }
```

**기록 조건 매트릭스:**

| 시나리오 | kind | action | severity | 기록 위치(파일:함수) |
|----------|------|--------|----------|----------------------|
| A1 direct | `SELF_REFERRAL` | BLOCKED | 4 | `user/user.service.ts::createUser` |
| A1 ancestor | `ANCESTOR_SELF_REFERRAL` | BLOCKED | 4 | `user/user.service.ts::createUser` |
| A2 | `CIRCULAR` | BLOCKED | 5 | `user/user.service.ts::createUser` (post-insert guard) |
| A3 | `DUPLICATE_CI` | BLOCKED | 5 | `user/user.service.ts::createUser` |
| A4 | `RATE_LIMIT` | LOGGED | 2 | `@nestjs/throttler` (interceptor 확장 시) |
| A5 | `SWAP` | HELD | 3 | (TODO) admin 배치 잡 |
| T5 | `WITHDRAW_REJOIN_COOLDOWN` | BLOCKED | 3 | `user/user.service.ts::createUser` |
| T6 | `STAFF_REFERRAL` | BLOCKED | 4 | `user/user.service.ts::createUser` |

**보존 기간**: 5년 (비기능 요구사항 관측성 기준).

**민감정보 마스킹**: `evidence.jsonb` 안의 `ciHash` 는 해시 상태로 저장 (평문 `ci` 는 절대 기록 금지). IP/디바이스 지문도 `hashForAudit()` 결과만 저장.

---

## qa-integrator 용 종합 assertion 목록

1. `POST /auth/signup` — 동일 ci 재시도: status=409, code=`USER_CI_DUPLICATE`, AbuseLog 1건 (`DUPLICATE_CI`)
2. 셀프레퍼럴: code=`REFERRAL_SELF_FORBIDDEN`, AbuseLog `SELF_REFERRAL` or `ANCESTOR_SELF_REFERRAL`
3. 순환참조: code=`REFERRAL_CYCLE_DETECTED`, AbuseLog `CIRCULAR`, User row 미생성
4. 탈퇴 쿨다운: code=`WITHDRAW_REJOIN_COOLDOWN`, AbuseLog `WITHDRAW_REJOIN_COOLDOWN`
5. STAFF 참여: code=`STAFF_REFERRAL_FORBIDDEN`, AbuseLog `STAFF_REFERRAL`
6. 레이트 리밋: 121번째 요청 status=429
7. 주문 배분: staff/withdrawn/banned beneficiary 존재 시 해당 세대 ledger 생성 skip, `ReferralLedger` 카운트 = ancestors - 차단 수
8. MINOR_HOLD beneficiary: ledger status=`SUSPENDED_FOR_REVIEW`, payout status=`WITHHELD`

---

## 변경 이력

| 날짜 | 항목 |
|------|------|
| 2026-04-21 | 초안 작성, A1~A5 + T5 방어선 정리 — backend-engineer |
