# Nuxia2 — Commerce Hybrid App with 3-Tier Referral System

## 하네스: 커머스 하이브리드앱 × 3세대 레퍼럴

**목표:** Nuxia 디자인 톤의 모바일 퍼스트 반응형 커머스 웹 + Capacitor 하이브리드앱. 3세대 레퍼럴(1대 3% / 2대 5% / 3대 17% = 25%) 수익 분배 엔진 포함. 포트원 결제/본인인증 연동. 셀프레퍼럴·순환참조·다중계정 어뷰징 방지.

**기술 스택:** Next.js 14 (App Router) + Tailwind + shadcn/ui + Capacitor / NestJS + PostgreSQL + Prisma / 포트원(본인인증 + 결제)

**트리거:** 커머스/레퍼럴/상품/주문/결제/포트원/본인인증/초대/수익 관련 작업 요청 시 `nuxia-commerce-orchestrator` 스킬을 사용하라. 후속 키워드(재실행, 다시, 수정, 보완, 부분재실행, 이전 결과 기반)도 동일 스킬 트리거. 단순 질의는 직접 응답 가능.

**산출물 위치:**
- 중간 산출물: `_workspace/`
- 코드: `apps/web/`, `apps/mobile/`, `apps/api/`, `packages/shared-types/`
- QA 스크립트: `scripts/qa/`

**기준 시나리오 (불변):** 3대 유저 D가 1,000,000원 주문 시 C=30,000원 / B=50,000원 / A=170,000원, 합계 25%.

**어뷰징 방지 3대 원칙:** `ci` UNIQUE + 셀프레퍼럴 체인 검사 + 순환참조 재귀 CTE 검증.

**변경 이력:**

| 날짜 | 변경 내용 | 대상 | 사유 |
|------|----------|------|------|
| 2026-04-21 | 초기 구성 — 에이전트 5인(analyst/designer/frontend/backend/qa) + 스킬 7종(requirements-spec / nuxia-design-extract / nextjs-capacitor-build / commerce-api-build / referral-engine / cross-boundary-qa / nuxia-commerce-orchestrator) + CLAUDE.md | 전체 하네스 | 신규 프로젝트 구축 |
| 2026-04-21 | T1-T8 정책 확정 + Phase 2 구현 + Phase 3 QA v1/v2 fix loop (21건 resolved) | backend/frontend/qa 전원 | Phase 3 QA CLEAR |
| 2026-04-21 | Phase 4 통합 릴리스 v0.1.0 — README 전면 보강, CHANGELOG, RELEASE_NOTES, OpenAPI export 스크립트, Capacitor 빌드 가이드 | docs + apps/api/scripts | v0.1.0 릴리스 기반 완성 |
| 2026-04-21 | v0.2.0 스프린트 — 실 Prisma 마이그레이션(360줄) + seed.ts(23 레코드) + docker-compose + Makefile + vitest E2E(34 it) + JWT refresh + Admin API 확장 + N1/N2/N3 non-blocker 해소 | backend/infra(general-purpose)/qa 병렬 + route 수정 | 로컬 실행 가능 + 자동화 검증 |
| 2026-04-21 | Frontend dev server 부팅 검증 — `(mypage)` 라우트 그룹이 `(shop)` 루트와 충돌 → `mypage/` 세그먼트로 변경. pnpm install 823 packages. 홈/대시보드/트리/가입/초대 렌더링 스크린샷 확인 | apps/web/app/mypage/ | 라우팅 충돌 수정 + v0.2 UI 렌더링 검증 |
| 2026-04-21 | v0.3.0 스프린트 — Admin UI 5 라우트+7 컴포넌트(다크, 3중 인코딩) + Dockerfile 2종 + GitHub Actions CI 2종 + Webhook E2E 6 it(총 40 it) + categoryId legacy 제거 + /health 엔드포인트 + pino 구조화 로그 + correlation-id | frontend/backend/infra 병렬 | 운영 가시성 + 컨테이너 재현 + CI 게이트 |
| 2026-04-21 | v0.3.1 기능 보강 — 배송지 폼 + 상품 필터/검색 + 결제수단 탭 3종 (카드/계좌이체/간편결제) | frontend 단독 | 체크아웃 플로우 + 카테고리 필터 |
| 2026-04-21 | v0.4.0 스프린트 — Admin BE 4 신규(kpi/users/users:id/payouts) + 2FA TOTP(4 엔드포인트+3 FE 컴포넌트+1 page) + Prometheus /metrics 5 custom + Audit log interceptor 6 엔드포인트 + JWT 쿠키 통합 + shared-types admin.ts 8 신규 스키마 + 테스트 40→51 | backend/frontend/infra 병렬 | 관리자 실 데이터 연동 + 보안 + 관측성 |
