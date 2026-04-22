# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Non-blocker residuals
- `apps/api`가 아직 `@nuxia2/shared-types`를 import하지 않음 (workspace 링크 TODO)
- `ProductListQuerySchema.categoryId`는 `categoryName`으로 리네임 예정
- checkout/success 페이지의 재시도 버튼은 BE의 idempotent confirm에 의존

---

## [0.1.0] - 2026-04-21

첫 구조적 기반(foundation) 릴리스. 프로덕션 진입 전에 필요한 레퍼럴 엔진, 어뷰징 방지, 경계면 타입 정합성이 모두 확보된 상태.

### Added

- 커머스 도메인 모델 (User / Product / Cart / Order / Payment / Refund / ReferralLedger / Payout)
- 3세대 레퍼럴 엔진 (1대 3% / 2대 5% / 3대 17% = 25%), 재귀 CTE 기반 ancestors 탐색
- BigInt 정수 연산 `floor(총액 × bps / 10000)` 배분 공식
- 레퍼럴 원장(`ReferralLedger`) — EARN / REVERT 이벤트 타입
- 환불 시 역정산(REVERT) 생성 로직 — 구매확정 7일 이전까지
- PortOne V2 결제 연동 (결제 완료 webhook + 서버측 금액 재검증)
- PortOne V2 본인인증 연동 (`identityVerificationId` → 서버 `ci` 획득)
- 어뷰징 방지 6층 가드 (A1-direct, A1-ancestor, A2 순환참조, A3 다중계정, T5 쿨다운, T6 STAFF 차단)
- `AbuseLog` 모델로 어뷰징 시도 전부 기록
- 원천징수 3.3% 자동 차감 (`Payout`)
- Next.js 14 App Router 프론트 (홈/상품/카트/체크아웃/마이/레퍼럴 대시보드)
- Tailwind config에 매핑된 102개 디자인 토큰 (colors/fontSize/spacing/radius/shadow)
- shadcn/ui 기반 UI 프리미티브 + Nuxia 톤 커스텀
- 레퍼럴 상태 3중 인코딩 UI (색 + 아이콘 + 라벨)
- zod 기반 공통 타입 (`packages/shared-types`)
- Capacitor 6 래퍼 및 딥링크 `nuxia2://referral/{code}` 핸들러

### Infrastructure

- pnpm workspace: `apps/(api,web,mobile)`, `packages/shared-types`
- Prisma 16 models + 9 enums, BigInt 금액, 암호화된 `ci`
- Tailwind config에 designer spec의 102개 디자인 토큰 주입
- Capacitor 6 (딥링크 `nuxia2://referral/{code}`)
- BullMQ (Redis) 기반 비동기 잡 러너 예비

### Security

- PortOne V2 서버측 결제 금액 검증 (Serializable 트랜잭션)
- Webhook HMAC 서명 검증 + 4-tuple idempotency (`imp_uid` + `merchant_uid` + `status` + `paid_at`)
- AES-256-GCM `ci` 암호화 저장 + 결정론적 HMAC 인덱스 (검색 가능한 UNIQUE)
- 부팅 시 필수 env (JWT_SECRET / DATABASE_URL / PORTONE_API_SECRET) 검증 후 실패 시 즉시 종료
- JWT_SECRET 최소 32자 강제
- 평문 `ci` 로깅 금지

### Fixed (Phase 3 QA 루프)

- v1 경계면 이슈 18건 (P0 9건 + P1 5건 + P2 3건 일부) 해결
- v2 회귀 테스트에서 발견된 신규 이슈 3건(P1-NEW × 2, P2-NEW × 1) 해결
- 상세: [`_workspace/04_qa_report.md`](_workspace/04_qa_report.md)

### Non-goals (deferred)

- 실제 프로덕션 마이그레이션 + 시드 데이터
- 관리자 대시보드 UI
- iOS/Android 네이티브 프로젝트 실제 생성 (`cap add` 보류)
- Cart/Checkout 배송지 입력 플로우
- JWT refresh token 엔드포인트
- 실제 정산 배치 크론
