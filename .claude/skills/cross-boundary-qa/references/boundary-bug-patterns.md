# Boundary Bug Patterns — 경계면 버그 7패턴

실제 프로젝트에서 반복 관찰된 경계면 버그 유형. 각 모듈 QA 시 체크리스트로 활용.

## 패턴 1: Shape Drift (타입 표류)

**증상:** 백엔드 DTO 필드명/타입이 변경됐는데 프론트가 추적 못 함 → 런타임에 `undefined` 또는 잘못된 값 표시

**예시:** 백엔드가 `amountKrw: BigInt`인데 JSON 직렬화 시 문자열로 나감, 프론트는 `number`로 기대 → `toLocaleString()` 호출 실패

**검출:** 공유 zod 스키마로 런타임 검증. JSON BigInt는 string으로 직렬화되므로 프론트도 string으로 받아 BigInt로 복원

**방지:** `packages/shared-types/`에 단일 소스 zod 스키마, FE/BE 모두 의존

## 패턴 2: 금액 단위 불일치 (Unit Confusion)

**증상:** 원(KRW)과 전(분 단위)이 혼재 → 100배 차이 버그

**예시:** 포트원 응답은 원 단위, 내부 DB도 원 단위인데 프론트가 전 단위(×100) 기대 → 화면에 100,000원이 1,000원으로 표시

**검출:** 경계 지점에 단위 주석 필수(`// KRW cents? No, KRW integer (원)`)

**방지:** 전 프로젝트 "원 단위 정수" 규칙 + `BigInt` 타입

## 패턴 3: Nullable / Optional 오해

**증상:** 백엔드는 `nullable`로 설계, 프론트는 항상 존재 가정 → `Cannot read property 'x' of null`

**예시:** `User.referrer`가 nullable인데 프론트가 `user.referrer.nickname` 직접 접근

**검출:** TypeScript strict mode + zod `.optional()` / `.nullable()` 명시

**방지:** Boundary Pair 검증 시 null 체크 매트릭스 작성

## 패턴 4: 상태 전이 순서 불일치

**증상:** 프론트에서 기대하는 상태 흐름과 백엔드 실제 전이가 다름

**예시:** 프론트는 `Order.status: PENDING → PAID → CONFIRMED`로 가정, 실제는 `PENDING → PAID → SHIPPED → CONFIRMED` → UI에서 SHIPPED 처리 누락

**검출:** 백엔드 상태 머신 다이어그램과 프론트 스위치문 대조

**방지:** enum을 공유 타입에 두고, 프론트 switch는 exhaustive check

## 패턴 5: 이중 진실의 원천 (Dual Source of Truth)

**증상:** 같은 데이터가 두 곳에 저장되고 synchronization이 깨짐

**예시:** 레퍼럴 금액이 `ReferralLedger` 합계 vs `User.totalEarned` 캐시 컬럼 → 불일치

**검출:** 주기적으로 두 값을 재계산 & 비교하는 잡 실행

**방지:** 단일 원천(Ledger)만 신뢰, 표시는 실시간 집계 또는 매번 무효화되는 캐시

## 패턴 6: Off-by-N / 세대 경계

**증상:** 3세대까지 지급해야 하는데 2세대까지만, 또는 4세대에도 지급됨

**예시:** 재귀 CTE의 `WHERE c.gen < 4` 조건을 `<=` 혹은 `< 3`으로 잘못 작성

**검출:** 기준 시나리오(A→B→C→D, D 구매)에서 A가 지급받고 A의 추천인은 지급받지 않음을 명시적으로 검증

**방지:** 경계 조건 전용 테스트 케이스 상시 유지

## 패턴 7: 비동기 이벤트 누락

**증상:** 포트원 Webhook이 비동기 도착, 그사이 사용자가 주문 상태 확인 → 불일치 표시

**예시:** 결제 성공 콜백이 왔지만 Webhook은 아직 도착 안 함 → 관리자 페이지에는 PAID, 사용자 앱에는 PENDING

**검출:** 이벤트 시간 차이를 시뮬레이션하는 테스트

**방지:**
- Webhook은 idempotent
- 사용자 플로우에서 결제 콜백 수신 후 백엔드 `confirm` 호출을 명시적으로 수행 (Webhook에만 의존 금지)

## 추가 관찰 포인트

### 7.1. 타임존
- 서버 `UTC`, 클라이언트 `Asia/Seoul` → 일별 집계 경계 착오
- 모든 날짜는 ISO 8601 + UTC로 전송, 표시 시만 로컬 변환

### 7.2. 숫자 포맷팅
- `toLocaleString('ko-KR')` vs 수동 `'1,000,000'` 포맷
- BigInt 문자열을 바로 포맷 함수에 넣으면 TypeError → 변환 래퍼 필요

### 7.3. 이미지/파일 URL
- 로컬 개발은 `http://localhost:4000`, 배포는 CDN — `.env` 분기 누락 시 프로덕션에서 broken image

## 체크리스트 사용법

각 모듈 QA 세션에서 이 7패턴을 순서대로 적용:
- 해당 패턴이 이 모듈에 **해당 없음(N/A)** 이면 명시
- **해당함**이면 Boundary Pair 파일 나열 + 검증 결과 기록
