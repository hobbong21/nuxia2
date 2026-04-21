# 01a. 정책 확정 (T1~T8)

> 사용자 결정: 2026-04-21
> 원본 질문: `_workspace/01_analyst_requirements.md` 하단 TODO 섹션
> 결정 방침: "현재 가정 그대로 확정, 이후 조정은 변경 이력으로 관리"

이 문서는 **Phase 2 구현 에이전트(backend-engineer, frontend-engineer)가 확정된 정책으로 참조**합니다. 가정이 아니라 정책입니다.

## 확정 내역

| # | 항목 | **확정 정책** | 구현 반영 위치 |
|---|------|---------------|----------------|
| T1 | 원천징수 | **사업소득 3.3% 적용** (소득세 3% + 지방소득세 0.3%). 향후 세무 자문으로 "기타소득 8.8%" 전환 시 `config.tax.withholdingRate` 환경 변수로 조정 | `apps/api/src/modules/payout` |
| T2 | 유보 7일 후 환불 시 역정산 | **역정산 생략** (cutoff 정책). 환불은 가능하되 `ReferralLedger`에 `REVERT` 생성하지 않음. 플랫폼이 손실 흡수 | `apps/api/src/modules/referral`의 `revert()` 함수 |
| T3 | 레퍼럴 기준 금액 | **쿠폰 차감 후 금액** (실 결제금액 기준). 프로모션은 플랫폼 부담, 레퍼럴은 실제 수령액 기준 | `Order.totalAmountKrw` = 할인 적용 후 |
| T4 | 간편결제 포인트 | **현금성으로 분류** (배분 기준액에 포함). 포트원 응답의 `payMethod` 확인 후 `card_point`/`point` 제외 시 재조정 | `PaymentService.confirm()` 금액 검증 |
| T5 | 탈퇴 후 재가입 | **체인 복구 금지**. 탈퇴 시 `User.status=WITHDRAWN` + 동일 `ci` 재가입 불가(cool-down 30일). 관리자 재량 이관만 허용 | `apps/api/src/modules/user` 및 `AbuseLog` |
| T6 | 내부 임직원 추천 | **전 직원 참여 불가** (role=STAFF 마킹). 직원 본인·직계가족(별도 플래그) 모두 `referrer`·`referee` 양쪽 불가 | `User.role` 컬럼 추가, 가입 가드 |
| T7 | 미성년 성년 도달 | **수동 해제**. 성년 도달만으로 자동 지급 활성화 금지. 관리자 페이지에서 `PayoutEligibility` 토글 필요 | Admin 페이지 + `User.payoutEligibility` 플래그 |
| T8 | 결손 세대(상위 추천인 부재) | **플랫폼 귀속** (플랫폼 수익으로 잡음, 프로모션 풀 재활용 ✗). 별도 `PlatformRevenue` 원장에 기록하지 않고 단순히 배분에서 생략 | 현재 `referral-engine`의 "상위 없으면 건너뜀" 그대로 |

## 데이터 모델 추가/확장

위 결정으로 Prisma 스키마에 반영할 변경사항:

```prisma
// User 모델에 추가
enum UserRole { CUSTOMER STAFF STAFF_FAMILY ADMIN }
enum UserStatus { ACTIVE SUSPENDED BANNED WITHDRAWN UNDER_REVIEW MINOR_HOLD }

model User {
  // ... 기존 필드
  role                UserRole   @default(CUSTOMER)
  payoutEligibility   Boolean    @default(true)   // 미성년·수동유보 제어
  withdrawnAt         DateTime?
  // ...
}

// 새 모델: 원천징수 설정 (config 대체 안전장치)
model PayoutTaxConfig {
  id              String   @id @default(cuid())
  effectiveFrom   DateTime
  withholdingBps  Int                               // 330 = 3.30%
  kind            String                            // 'BUSINESS_INCOME' | 'OTHER_INCOME'
  note            String?
}
```

## 엣지 케이스 재정리 (Phase 2 구현 필수 고려)

### 쿠폰 + 부분환불
`Order.totalAmountKrw`는 쿠폰 차감 후 금액. 부분환불 시 `ratio = refundedAmount / totalAmountKrw`. 단순 비례.

### 간편결제 포인트 예시
- 주문 총액 100,000원 (카드 70,000 + 포인트 30,000)
- `totalAmountKrw = 100,000` (포인트는 현금성으로 인정)
- 레퍼럴 배분 = 100,000 × 25% = 25,000 (1대 3k / 2대 5k / 3대 17k)
- 향후 재조정 필요 시 `PaymentService`의 `getReferralBaseAmount()` 함수로 추출 가능하도록 구현

### STAFF 가입 차단
- 회원가입 API에서 `Assumption`: 이메일 도메인 또는 별도 화이트리스트
- STAFF_FAMILY는 관리자 수동 지정
- 위반 시 `AbuseLog(kind='STAFF_REFERRAL', detail={userId, referrerId})` 기록

### 탈퇴 쿨다운
- `WITHDRAWN` 사용자의 `ci`로 30일 이내 재가입 시도 → `409 Conflict`, `AbuseLog(kind='WITHDRAW_REJOIN_COOLDOWN')`
- 30일 이후 재가입은 **새 계정으로 처리**, 이전 체인 승계 없음(referrerId는 신규 지정)

## 변경 이력 (CLAUDE.md에 반영)

```
| 2026-04-21 | T1-T8 정책 확정 (원천징수 3.3% / 유보후환불 역정산생략 / 쿠폰차감후 기준 / 포인트 현금성 / 탈퇴쿨다운 30일 / 임직원 참여불가 / 미성년수동해제 / 결손세대 플랫폼귀속) | _workspace/01a_policy_confirmations.md + Prisma 스키마 | 사용자 옵션B 선택, 빠른 Phase 2 진입 |
```
