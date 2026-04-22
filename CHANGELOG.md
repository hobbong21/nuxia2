# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned (v0.5)
- 실제 BE 서비스 호출 경로에 `metrics.inc*()` 연결 (referral engine, payment, webhook)
- Admin 감사 인터페이스 (AuditLog 조회 UI)
- SMS/이메일 OTP 옵션 (TOTP 외 백업 방식)
- i18n (한국어 외 영어/일어)
- 관리자 2FA 활성 강제 정책 토글

---

## [0.4.0] - 2026-04-21

관리자 BE API 완성 + JWT 세션 + 2FA + Prometheus metrics + Audit log. v0.3의 관리자 UI가 실 데이터와 연동되고, 프로덕션 보안/관측 기반이 확보된 상태.

### Added

- **Admin BE API 4 신규 엔드포인트** (M1):
  - `GET /admin/kpi` — 이번 달 어뷰징 차단 / 미지급 정산 NET / 미성년 유보 / 활성 사용자 수 (KST 월 경계)
  - `GET /admin/users?query=&cursor=&limit=` — 이메일/닉네임 iLike 검색 + 커서 페이지네이션
  - `GET /admin/users/:id` — `ciMasked` 마스킹 + `flaggedCount` 집계
  - `GET /admin/payouts?cursor=&limit=`
- **shared-types 신규 8 스키마** (`admin.ts`): AdminKpi, AdminUser, PaginatedAdminUsers, PaginatedPayouts, TotpSetupResponse, TotpVerifyRequest, LoginStepOneResponse, TotpLoginRequest
- **JWT 세션 ↔ 관리자 쿠키 통합** (M2): 로그인 시 `role=ADMIN`이면 `Set-Cookie: nx_role=ADMIN; HttpOnly; SameSite=Lax; Secure` 발행. FE `admin-client.ts` fetch에 `credentials: 'include'`
- **Prometheus /metrics + prom-client 5 커스텀 메트릭** (M3):
  - Counter: `nuxia2_referral_distribute_total{result}`, `nuxia2_payment_confirm_total{result}`, `nuxia2_abuse_blocked_total{kind}`, `nuxia2_webhook_received_total{source,status}`
  - Gauge: `nuxia2_minor_hold_total`
  - 프로덕션은 `X-Internal-Secret` 헤더 (env `METRICS_INTERNAL_SECRET`)
- **Audit Log 인프라** (M4):
  - `@Audit('KIND')` 데코레이터 + `AuditLogInterceptor` (응답 성공 시 자동 기록)
  - 6 관리자 mutating 엔드포인트에 적용: USER_FLAG, USER_MARK_STAFF, USER_SUSPEND, USER_RELEASE_MINOR, PAYOUT_RUN, PAYOUT_RELEASE
- **2FA (TOTP) 전체 흐름** (M5):
  - Backend: `otplib` + `qrcode`, `totp.service` (generate/verify/disable), `/auth/2fa/{setup,verify,disable,login}` 4 엔드포인트
  - Prisma 스키마: `User.totpSecret`(암호화) / `totpEnabled` / `totpEnabledAt` / `lastLoginAt`
  - 마이그레이션: `20260421000001_add_totp/migration.sql`
  - Frontend: `TotpField` (6자리 auto-submit + paste), `TotpSetupModal` (QR → verify), `TotpDisableModal`, `/mypage/security` 페이지
  - 로그인 1단계(email/pw) → 2단계(TOTP) 자동 전환 (`LoginStep1Response` union)
- **FE admin mock → real API 전환** (M6): `NEXT_PUBLIC_USE_MOCK` 환경변수 게이트 + 5 메서드 zod `safeParse`
- **Correlation-id outbound forward** (S1): `portone.client` 모든 HTTP 호출에 `X-Request-Id` 헤더 자동 주입 (AsyncLocalStorage 재사용)
- **X-Admin-Api-Key 가드** (S3, optional): `ADMIN_API_KEY` 환경변수 설정 시 `/admin/*` 2단 가드
- **TOTP / Admin 테스트 +11 it** (34→40→**51 it**):
  - `admin-api.test.ts` 4 it (KPI/users list/user detail/payouts)
  - `totp.test.ts` 3 it (setup → verify → disable)
  - `metrics.test.ts` 2 it (counter 증가)
  - `audit-log.test.ts` 2 it (flag 호출 후 AuditLog 생성)
- **Health 엔드포인트** (Dockerfile HEALTHCHECK 정합): `GET /health` + `GET /health/ready`

### Changed

- **BREAKING (API)**: 로그인 응답이 `AuthResponse` 또는 `{ needsTotp: true, userId }` 유니언. FE는 `LoginStep1ResponseSchema`로 분기 필요 (v0.4 FE 구현 완료).
- `apps/api/src/app.module.ts`: `AuditModule` + `MetricsModule` 전역 등록
- `apps/web/lib/admin-client.ts`: v0.3의 하드코드 `USE_MOCK=true`를 환경변수 게이트로 교체
- `packages/shared-types/src/index.ts`: `admin.ts` re-export

### Infrastructure

- `.env.example`에 3 신규 env (`ADMIN_API_KEY`, `METRICS_INTERNAL_SECRET`, `TOTP_ISSUER`)
- `.env.docker.example` + `docker-compose.yml` full profile env 확장 (api 3 + web 1)
- CI `ci.yml` e2e job env 3개 추가
- `README.md`: "핵심 기능"에 2FA · /metrics · Audit log 3 불릿 추가
- `docs/QUICKSTART.md`: v0.4 대섹션 (env 설명 + 2FA 활성화 가이드 + /metrics 접근법)
- `prom-client`, `otplib`, `qrcode` (+ @types/qrcode) deps 추가

### Non-goals (deferred to v0.5)

- 실제 도메인 서비스 경로에서 `metrics.inc*()` 호출 연결 (counter 정의만 완료)
- Admin UI에 AuditLog 조회 화면
- 백업용 SMS/이메일 OTP
- i18n

### Non-blocker residuals

- `apps/web/tsconfig.tsbuildinfo` 실수 커밋 — 다음 커밋에 `.gitignore` 추가
- FE 타입체크 일부 strict 경계(zod `.optional()` ↔ plain `Cursor<T>` interface)에서 경고 — 런타임 영향 없음, v0.5에 정리
- `apps/web/.env.example` 부재 — FE 개발자 생성 필요
- Docker 실제 `docker build` 스모크 미수행 (Docker 미설치 환경)

---

## [0.3.0] - 2026-04-21

운영 관리 + 컨테이너 재현 + CI 자동화. v0.2 위에 관리자 가시성, 2종 Dockerfile, GitHub Actions, Webhook E2E, 구조화 로그를 추가.

### Added

- **관리자 화면 skeleton** (M1):
  - 라우트 5개: `/admin`, `/admin/abuse-logs`, `/admin/users`, `/admin/users/:id`, `/admin/payouts`
  - 컴포넌트 7개: Sidebar, DataTable(커서 페이지네이션), AbuseKindBadge(5종 3중 인코딩), AdminKpiCard, UserTreePanel, FlagUserButton, ReleaseMinorButton
  - 기본 다크 테마 (`zinc-950/900/800` 팔레트)
  - `apps/web/middleware.ts`: `nx_role=ADMIN` 쿠키 가드, `NEXT_PUBLIC_ADMIN_BYPASS=1` 개발 우회 (프로덕션 빌드 무시)
  - `apps/web/lib/admin-client.ts` 8 메서드, `USE_MOCK` 게이트로 BE 미기동 시 UI 확인 가능
  - Mock 데이터 36개 (abuse logs 20 + users 10 + payouts 5 + tree 1)
- **Dockerfile 2종** (M2):
  - `apps/api/Dockerfile` — multi-stage 4 (base/deps/build/runtime), node:20-alpine, pnpm@9, Prisma generate + Nest build, non-root, HEALTHCHECK `/health`
  - `apps/web/Dockerfile` — multi-stage 4, Next.js standalone output, non-root
  - `.dockerignore` 각 앱에 추가
  - `apps/web/next.config.mjs` HYBRID 분기 (`HYBRID_BUILD=1` → export, 기본 → standalone)
- **GitHub Actions CI** (M3):
  - `.github/workflows/ci.yml`: 3 job (typecheck / lint / e2e)
  - E2E job은 `postgres:16-alpine` + `redis:7-alpine` service container + `prisma migrate deploy` + `vitest run`
  - `.github/workflows/docker-build.yml`: main+tag push → GHCR buildx (api/web 병렬, type=gha cache)
- **Webhook E2E 테스트** (M4):
  - `apps/api/test/webhook-portone.test.ts` 6 it (유효 HMAC / 무효 / idempotent / eventType 분리 / dev bypass / prod 거부)
  - 총 테스트 **40 it** (v0.2 34 + 6)
- **Health 엔드포인트** (Dockerfile 정합):
  - `GET /health` (liveness, uptime)
  - `GET /health/ready` (readiness, DB 연결 확인)
- **구조화 로그** (S1):
  - `apps/api/src/common/logger/logger.config.ts` — `NODE_ENV=production` JSON / 그 외 pino-pretty 분기
  - `correlation-id.interceptor.ts` + `AsyncLocalStorage` — 요청 단위 correlation-id (Node 내장 `crypto.randomUUID()`, 신규 deps 0)
- **루트 `package.json`**: `pnpm -r --if-present run {typecheck,lint,test}` 통합 스크립트
- **`docker-compose.yml` full profile 활성**: api/web 서비스에 환경변수 블록 하드코딩, `env_file` optional, 네트워크 이름 명시

### Changed

- **BREAKING (v0.2 → v0.3)**: `product.controller`의 `?categoryId=` legacy fallback 삭제. `?categoryName=`만 수용 (shared-types와 단일 소스).
- `apps/web/next.config.mjs` standalone 기본값 (Docker 런타임 지원)
- `apps/api/src/app.module.ts`: `LoggerModule` + `HealthModule` 등록, `bufferLogs: true` (`main.ts`)

### Fixed

- `shared-types/src/referral.ts` `TreeNodeSchema.children`의 `.default([])` 제거 — `z.ZodType<TreeNode>` 타입 정합 맞춤 (`tsc --noEmit` CLEAN)

### Infrastructure

- `apps/web/public/.gitkeep` — Dockerfile COPY 실패 방지
- `pino-pretty ^11.2.2` devDep (backend logger pretty 분기 전용)

### Non-goals (deferred to v0.4)

- 실제 JWT 세션 ↔ admin role cookie 통합
- 관리자 2FA UI
- `/metrics` 엔드포인트
- Audit log 일관화
- Capacitor Android CI

### Non-blocker residuals

- `apps/web/app/(admin)/admin/` 폴더 중첩 (route group + URL segment) — URL `/admin/*`은 정상, 빌드·컴파일 영향 없음
- 트리 인라인 플래그 오버레이는 현재 패널 상단 요약으로만 표시 (`ReferralTreeNode.renderBadge` slot 도입 시 개선)
- Admin API 일부(`getKpi`, `getUsers` 검색, `getUser` 단건, `getPayouts` 목록, `flagUser`) BE 엔드포인트 합의 필요 — 현재 FE는 mock으로 돌아감
- Preview 렌더러 일시 행업 (Chrome DevTools protocol 이슈) — innerText 검증으로 보완

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
