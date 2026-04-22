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
