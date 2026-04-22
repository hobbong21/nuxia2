# Nuxia2 v0.1.0 — Foundation Release

**날짜:** 2026-04-21
**빌드 ID:** `bd94b5a`
**커밋 수:** 7

## 하이라이트

이번 릴리스는 Nuxia2 커머스 하이브리드앱의 **구조적 기반(foundation)**을 완성합니다. 프로덕션 진입 전에 필요한 레퍼럴 엔진, 어뷰징 방지, 경계면 타입 정합성이 모두 확보되었습니다.

### 3세대 레퍼럴 엔진 무결성

- 1,000,000원 주문 기준 1대 30k / 2대 50k / 3대 170k 정확 ✓
- 재귀 CTE + BigInt 정수 연산으로 부동소수점 오차 0
- 환불/취소 시 REVERT 원장 생성 → 순액 0 보장
- 구매확정 7일 이후 환불은 역정산 생략 정책 적용 (플랫폼 손실 흡수)
- 결손 세대(상위 부재)는 플랫폼 귀속

### 어뷰징 방어 6층

| 코드 | 가드 | 구현 |
|------|------|------|
| A1-direct | 본인 직접 추천 차단 | 가입 서비스 레이어 |
| A1-ancestor | 체인 내 동일 `ci` 금지 | 재귀 ancestors 조회 |
| A2 | 순환참조 차단 | post-insert 검증 |
| A3 | 다중계정 차단 | `ci` UNIQUE + 앱 레벨 재확인 |
| T5 | 탈퇴 후 30일 쿨다운 | `withdrawnAt` 체크 |
| T6 | STAFF/직계가족 참여 차단 | `role` 가드 |

### Nuxia 톤 디자인 시스템

- 102개 디자인 토큰 (colors 40 / fontSize 12 / spacing 16 / radius 6 / shadow 6 / 기타)
- 모바일 퍼스트 반응형, WCAG 2.1 AA 준수
- 레퍼럴 상태 3중 인코딩(색+아이콘+라벨)로 색맹/흑백인쇄 대응
- confetti/레벨업 이펙트 미사용(투명성 우선)

### 포트원(PortOne) V2 연동

- 결제 금액 서버 재검증 (프론트 신뢰 금지)
- Webhook HMAC 서명 + 4-tuple idempotency
- 본인인증 `identityVerificationId` 후 서버가 직접 `ci` 획득
- `ci`는 AES-256-GCM 암호화 저장, HMAC 인덱스로 UNIQUE 검색

### Capacitor 하이브리드

- Next.js static export → iOS + Android 래핑
- 딥링크 `nuxia2://referral/{code}` + Universal Link `https://nuxia2.app/r/{code}`
- safe-area, 키보드 회피, 하드웨어 백 버튼 지원
- 네이티브 공유 시트(`@capacitor/share`)로 레퍼럴 초대

## 품질 지표

- **Phase 3 QA 결과:** CLEAR
- **경계면 이슈 해결:** 18 v1 + 3 v2 new = **21/21 resolved**
- **기준 시나리오:** 3대 분배 1,000,000원 → 30k/50k/170k PASS
- **어뷰징 회귀:** A1-direct / A1-ancestor / A2 / A3 / T5 / T6 모두 PASS
- **원자성 회귀:** 결제 Serializable / Ledger UNIQUE / Webhook 4-tuple idempotency PASS

## 다음 릴리스 예정

### v0.2.0 (Phase 5 계획)

- 실제 마이그레이션 스크립트 + 시드 데이터
- E2E 테스트 스위트 (scripts/qa/* 전체 실행)
- docker-compose 로컬 개발 환경

### v0.3.0

- 관리자 대시보드 (AbuseLog 조회, 수동 심사 승인, 미성년 해제)
- 정산 자동화 (월간 Payout 배치, 원천징수 적용)

### v1.0.0

- 프로덕션 환경 구성 (CI/CD, 모니터링, 알림)
- 실사용 스테이징 테스트
- 보안 감사 (OWASP ASVS)

## 감사

이 릴리스는 5명의 AI 에이전트 팀이 [Harness](https://github.com/revfactory/harness) 메타스킬 기반으로 자율 협업하여 완성했습니다. product-analyst, ux-designer, frontend-engineer, backend-engineer, qa-integrator가 Phase 1~4에 걸쳐 요구사항→디자인→구현→QA→릴리스 통합을 수행했습니다.
