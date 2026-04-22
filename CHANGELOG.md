# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned (v0.3)
- 관리자 대시보드 UI (AbuseLog 조회, 수동 심사 승인 워크플로)
- `apps/api/Dockerfile` + `apps/web/Dockerfile` (multi-stage) — 현재 compose `full` profile은 빌드파일 추가 후 활성
- GitHub Actions CI (`.github/workflows/`): Postgres service container + E2E 실행
- Webhook E2E 테스트 (포트원 서명 + idempotency) — 현재는 단위만
- `ltree` 확장 기반 대규모 트리 조회 최적화 (>100k 노드 전제)

---

## [0.2.0] - 2026-04-21

로컬 실행 가능 + 자동화 검증 릴리스. v0.1 기반 위에 실제 마이그레이션, 시드 데이터, docker 기반 로컬 환경, vitest E2E 테스트 스위트, JWT refresh, Admin API 확장 추가.

### Added

- **실 Prisma 마이그레이션**: `apps/api/prisma/migrations/20260421000000_init/migration.sql` (약 360 라인, enum 9 + 테이블 16 + UNIQUE 인덱스 10 + 일반 인덱스 17 + 외래키 15)
- **시드 스크립트**: `apps/api/prisma/seed.ts` — 4대 체인 A→B→C→D + STAFF 1명 + 상품 10종 + 주문 3건 + PayoutTaxConfig (총 23 레코드)
- **Docker Compose 로컬 환경**: `docker-compose.yml` (postgres 16 + redis 7, healthcheck 포함), `api`/`web`은 `full` profile로 격리
- **Makefile** 11 타겟 (`up`, `down`, `db-migrate`, `db-seed`, `dev`, `test`, `reset`, `logs`, ...)
- **pgcrypto 확장** 초기화 스크립트 (`docker/postgres/init/01-extensions.sql`)
- **vitest E2E 테스트 스위트**: 6개 테스트 파일 + 34개 `it` 블록
  - `referral-engine.test.ts` — 기준 시나리오(1,000,000원→30k/50k/170k) + 환불 역정산 + floor 반올림 + 세대 경계
  - `payment-confirm.test.ts` — 포트원 금액 검증 + idempotent confirm
  - `abuse-self-referral.test.ts` — A1-direct / A1-ancestor
  - `abuse-circular.test.ts` — A2 순환참조
  - `abuse-multi-account.test.ts` — A3 + T5 쿨다운 + T6 STAFF
  - `boundary-shape.test.ts` — API 응답 × shared-types zod 스키마 정합성
- **JWT Refresh 엔드포인트** — `POST /auth/refresh` + Session TTL/revoke 검증 + 토큰 rotation (S1)
- **Admin API 확장** (S2):
  - `GET /admin/abuse-logs?kind&cursor&limit` (커서 페이지네이션)
  - `GET /admin/users/:id/tree` (3 depth)
  - `POST /admin/users/:id/flag` (어뷰징 수동 플래그)
- **`shared-types` 스키마 확장**: `AuthRefreshRequestSchema`, `AuthRefreshResponseSchema`, `PaymentConfirmResponseSchema.alreadyPaid` (optional)
- **`.env.docker.example`, `.env.test.example`** 템플릿
- **`scripts/qa/baseline-math.ts`** — DB 없이 배분 산술을 검증하는 pre-flight 스크립트
- **`docs/QUICKSTART.md` 전면 개정** — docker compose 우선 경로 + 자주 생기는 에러 해결책 + Makefile 치트시트

### Changed

- **BREAKING (FE)**: `ProductListQuerySchema.categoryId` → `categoryName`. 프론트 쿼리 파라미터 키 변경 필요. 현재 `product.controller`에 legacy fallback 유지하여 점진적 마이그레이션 가능.
- `apps/api`가 `@nuxia2/shared-types`를 workspace 의존성으로 직접 import. 기존 로컬 복제된 zod 스키마(`ShippingAddressSchema` 등) 제거.
- Next.js route group `(mypage)` → 일반 세그먼트 `mypage/`. `(shop)`의 루트 `/`와 충돌하던 문제 해결.
- `packages/shared-types/package.json`에 `typecheck` 스크립트 추가.
- `scripts/qa/run-all.ts`가 placeholder에서 실제 vitest 오케스트레이터로 재작성됨.

### Fixed

- **N1**: `apps/api`의 로컬 `ShippingAddressSchema` 복제 제거 → shared-types 단일 소스
- **N2**: `ProductListQuerySchema.categoryId` → `categoryName` (v0.1의 하드코드 null 우회 해소)
- **N3**: `PaymentService.confirm()` idempotent 가드 — 동일 `paymentId` 재호출 시 `{ok, alreadyPaid:true}` 반환, 레퍼럴 재분배 없음. 다른 `paymentId`는 `409 PAYMENT_ID_MISMATCH`
- App Router 라우팅 충돌: `(mypage)` → `mypage` 리네임

### Infrastructure

- `pnpm-lock.yaml` 체크인 (823 패키지)
- `.dockerignore` 추가 (build context 경량화)
- `apps/web/next-env.d.ts` 업데이트 (Next.js 14.2 타입)
- `.gitignore`에 `node_modules/`, `apps/web/.next/`, `apps/web/out/`, `apps/api/dist/` 추가

### Non-goals (deferred to v0.3)

- 관리자 화면 skeleton UI (백엔드 API는 준비됨)
- `apps/api/Dockerfile` + `apps/web/Dockerfile` (현재 compose `full` profile 미완성)
- GitHub Actions CI 통합
- 실제 데이터 기반 회귀 테스트 (seed + 마이그레이션 실행 검증은 사용자 로컬에서)

### Non-blocker residuals

- FE가 `categoryId` 쿼리 파라미터를 사용하는 곳은 grep으로 확인 필요 (backend에 legacy fallback이 있어 즉시 깨지지는 않음)
- `apps/api` vitest devDep `vitest ^2.1.1`와 backend 추가 devDep이 한 package.json에 공존 — merge 시 충돌 없음 확인됨
- PowerShell 스크립트 대안(`scripts/dev/up.ps1`) — Makefile만으로 충분, 추후 선택적 추가

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
