# Abuse Prevention — 어뷰징 방지 구현

레퍼럴 25% 지급 구조에서 발생 가능한 악용을 정책→검출→차단 3층으로 방어한다.

## 1. 셀프레퍼럴 (본인이 본인을 추천)

### 정책
한 사람(`ci` 기준 동일인)은 자신의 추천인 체인에 포함될 수 없다.

### 검출
회원가입 시 3단계 확인:

```ts
async function detectSelfReferral(newCi: string, referrerUserId: string) {
  // 1. 추천인의 ci 획득
  const referrer = await prisma.user.findUniqueOrThrow({ where: { id: referrerUserId } })
  if (referrer.ci === newCi) return { blocked: true, reason: 'DIRECT_SELF_REFERRAL' }

  // 2. 추천인의 2·3대 ancestors의 ci도 확인 (동일인이 다른 계정으로 체인 형성)
  const ancestors = await queryAncestorsCI(referrerUserId, 3)
  if (ancestors.some((a) => a === newCi)) {
    return { blocked: true, reason: 'ANCESTOR_SELF_REFERRAL' }
  }

  return { blocked: false }
}
```

### 차단
- 가입 API에서 `409 Conflict` 응답
- `AbuseLog` 기록: `kind='SELF_REFERRAL'`, `detail={ newCi, referrerId, reason }`
- 해당 IP를 레이트 리밋 임계로 가중

## 2. 순환참조

### 정책
트리는 DAG(비순환)이어야 한다. ancestors에 현재 사용자 ID가 나타날 수 없다.

### 검출
`tree-schema.md`의 `assertNoCycle` 함수. 가입 트랜잭션 내에서 실행.

### 차단
- 트랜잭션 롤백
- `AbuseLog(kind='CIRCULAR', detail={ cycle_path })`

## 3. 다중계정

### 정책
1명의 실제 인간 = 1 계정. 본인인증 `ci`를 유일 식별자로 강제.

### 검출

**1차 (강한 신호):**
- `User.ci` UNIQUE 제약 → DB가 중복을 막음

**2차 (약한 신호, 점수화):**
| 신호 | 가중치 |
|------|--------|
| 동일 IP에서 24시간 내 다계정 가입 | +3 |
| 동일 디바이스 지문 | +5 |
| 추천인이 동일 | +2 |
| 주소가 동일 | +2 |

임계치 합 ≥ 7 → 수동 심사 플래그

### 차단
- 1차 검출은 즉시 가입 거부
- 2차 검출은 가입 허용하되 `User.status='UNDER_REVIEW'` (enum 확장 필요), 수익 지급은 `Payout.status='WITHHELD'`

### IP/디바이스 지문 수집 주의
개인정보보호법 준수. 수집 목적 명시 동의 필수. 저장은 해시 형태.

```ts
const ipHash = crypto.createHash('sha256').update(ip + process.env.SALT).digest('hex')
const deviceHash = crypto.createHash('sha256').update(deviceFp + process.env.SALT).digest('hex')
```

## 4. 봇 구매 / 레이트 리밋

### 정책
- 본인인증 미완료 계정은 주문 불가
- 동일 IP에서 분당 10회 초과 주문 차단

### 검출
- NestJS `ThrottlerGuard` 사용
- 의심 패턴(동일 상품 반복 구매, 즉시 환불 패턴) 별도 모니터링 잡

### 차단
- 레이트 리밋 초과 → `429 Too Many Requests`
- 의심 패턴 탐지 → 수동 심사 큐

## 5. 연계정보(ci) 관리 보안

- `ci`는 포트원 본인인증 응답으로만 획득
- 저장 시 앱 레벨 암호화(AES-256-GCM, KMS 마스터키)
- 로그 출력 금지 (마스킹)
- DB 백업 시 컬럼 단위 암호화 유지 확인

```ts
const encryptedCi = encrypt(rawCi, kmsKey)
await prisma.user.create({ data: { ci: encryptedCi, ... } })
```

검색 시에는 결정적 암호화(deterministic encryption) 또는 HMAC 키 기반 인덱스 사용.

## 6. 역정산 어뷰징 방어

- 주문을 반복 생성 → 환불 루프로 레이트 리밋 회피 어뷰징 방어
- 월별 환불율이 임계치(예: 40%) 초과하는 계정은 수동 심사
- 환불된 주문의 레퍼럴 원장은 즉시 `REVERT`, 지급 대기 중이면 원장에서 차감

## 7. 관리자 감사 인터페이스

관리자 화면에서 조회 가능해야 할 항목:
- 특정 사용자의 3대 트리 시각화
- `AbuseLog` 필터링 (kind, 기간, 사용자)
- `ReferralLedger` 사용자별/주문별 조회
- 의심 계정 수동 승인/차단 버튼

관리자 행위는 별도 `AuditLog`에 기록 (누가, 언제, 무엇을, 왜).

## 체크리스트

- [ ] 가입 트랜잭션 내에서 셀프레퍼럴 3단계 검사
- [ ] 순환참조 검증
- [ ] `ci` UNIQUE + 암호화 저장
- [ ] IP/디바이스 지문 점수 모델
- [ ] 레이트 리밋 (ThrottlerGuard)
- [ ] 환불율 모니터링 잡
- [ ] 관리자 감사 인터페이스
- [ ] `AbuseLog` + `AuditLog` 2종 분리
