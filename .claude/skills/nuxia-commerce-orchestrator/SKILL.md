---
name: nuxia-commerce-orchestrator
description: 커머스 하이브리드앱 + 3세대 레퍼럴 시스템 개발을 조율하는 오케스트레이터. 다음 상황에서 반드시 사용 - (1) "커머스 개발", "레퍼럴 앱 만들어줘", "상품/주문/결제 구현" 요청 시, (2) "레퍼럴 대시보드", "초대 링크", "수익 배분" 기능 요청 시, (3) "포트원 연동", "본인인증", "결제위젯" 구현 시, (4) "다시 실행", "재실행", "업데이트", "수정", "보완", "일부만 다시" 후속 요청 시, (5) "전체 QA", "경계면 검증", "어뷰징 테스트" 요청 시, (6) "이전 결과 기반으로", "결과 개선" 요청 시. product-analyst / ux-designer / frontend-engineer / backend-engineer / qa-integrator 5인 팀을 에이전트 팀 모드로 조율.
---

# Nuxia Commerce Orchestrator — 커머스 × 레퍼럴 하네스 오케스트레이터

Nuxia 스타일의 커머스 하이브리드앱 + 3세대 레퍼럴 수익 분배 시스템을 5인 에이전트 팀으로 구축한다.

## 팀 구성

| 에이전트 | 역할 | 주 스킬 |
|---------|------|---------|
| product-analyst | 요구사항/정책/어뷰징 모델링 | requirements-spec |
| ux-designer | Nuxia 스타일 추출 + 커머스 번안 | nuxia-design-extract |
| frontend-engineer | Next.js + Capacitor 구현 | nextjs-capacitor-build |
| backend-engineer | NestJS + 레퍼럴 엔진 + 포트원 | commerce-api-build + referral-engine |
| qa-integrator | 경계면 교차 검증 | cross-boundary-qa |

## 실행 모드

**하이브리드 (Phase별 재구성)**
- Phase 1-2: 기획/설계 팀 (analyst + designer)
- Phase 3: 구현 팀 — 팬아웃/팬인 (frontend + backend 병렬)
- Phase 4: QA — 생성-검증 (qa-integrator가 각 모듈 완성 직후 리뷰)
- Phase 5: 통합 릴리스 — 전원 재소집

## Phase 0: 컨텍스트 확인 (재호출 시 필수)

오케스트레이터 시작 시 `_workspace/` 상태 확인하여 실행 모드 결정:

| 조건 | 모드 |
|------|------|
| `_workspace/` 없음 | **초기 실행** — Phase 1부터 전체 |
| `_workspace/` 있음 + 사용자가 "부분 수정" 요청 | **부분 재실행** — 해당 산출물 생성한 에이전트만 재호출 |
| `_workspace/` 있음 + 사용자가 새 도메인/요구사항 제공 | **새 실행** — 기존 `_workspace/`를 `_workspace_prev/`로 이동 후 Phase 1부터 |
| `_workspace/04_qa_report.md`에 OPEN 이슈만 있음 | **이슈 해결 모드** — 해당 이슈 소유 에이전트만 재호출 |

```ts
// 의사 코드
const workspace = await readDir('_workspace/')
if (workspace.length === 0) {
  return 'INITIAL'
}
if (userPrompt.includes('다시 실행') || userPrompt.includes('재실행')) {
  if (userPrompt.match(/(요구사항|디자인|프론트|백엔드|QA)만/)) return 'PARTIAL'
  return 'NEW_RUN'  // 백업 후 재시작
}
if (hasOpenQaIssues()) return 'ISSUE_FIX'
return 'INITIAL'
```

## Phase 1: 요구사항 & 설계 (팀 모드)

**활성 팀원:** product-analyst + ux-designer

```
[오케스트레이터]
  ├── TeamCreate(name='requirements-design', members=[analyst, designer])
  ├── TaskCreate:
  │    ├── task-01: analyst → _workspace/01_analyst_requirements.md
  │    └── task-02: designer → _workspace/02_designer_spec.md (task-01 의존)
  ├── 팀원들이 SendMessage로 상호 질의
  ├── 두 산출물 완료 확인
  └── TeamDelete (다음 Phase 팀 재구성)
```

**실행 모드: 에이전트 팀**

## Phase 2: 병렬 구현 (팀 모드, 팬아웃/팬인)

**활성 팀원:** frontend-engineer + backend-engineer (+ analyst, designer는 질의 응답용)

```
[오케스트레이터]
  ├── TeamCreate(name='build', members=[frontend, backend, analyst, designer])
  ├── TaskCreate:
  │    ├── task-03a: backend → _workspace/03b_backend_api_contract.md + apps/api 구현
  │    ├── task-03b: frontend → _workspace/03a_frontend_impl.md + apps/web, apps/mobile 구현
  │    └── 두 작업은 병렬 수행, API 계약은 backend가 먼저 발행
  ├── backend → frontend: [backend→frontend] contract ready: /_workspace/03b_backend_api_contract.md
  ├── frontend → backend: [frontend→backend] contract request: {endpoint list}
  └── 두 작업 완료 시 Phase 3 진입
```

**실행 모드: 에이전트 팀**

**핵심 규칙:**
- backend가 OpenAPI 스펙을 먼저 발행 → frontend는 mock 데이터로 선행 구현 가능
- `packages/shared-types/` zod 스키마는 backend가 OpenAPI에서 생성
- 충돌 시 analyst에게 질의 (`[backend→analyst] clarify: 3대 수익 반올림 규칙`)

## Phase 3: 점진적 QA (생성-검증)

**활성 팀원:** qa-integrator (단독) + 각 모듈 담당자

QA는 **전체 완료 후**가 아니라 **각 모듈 완료 직후**:

| 모듈 완성 시점 | QA 트리거 |
|---------------|-----------|
| 상품/카트 API | `scripts/qa/product-shape-check.ts` 실행 |
| 주문/결제 모듈 | `scripts/qa/payment-mismatch.ts` + 포트원 모의 결제 |
| 레퍼럴 엔진 | `scripts/qa/referral-1m-test.ts` (기준 시나리오) |
| 환불 | `scripts/qa/refund-revert-test.ts` |
| 어뷰징 방지 | `scripts/qa/abuse-*.ts` 3종 |
| 전체 | `scripts/qa/run-all.ts` + `scripts/qa/boundary-shape-check.ts` |

```
[오케스트레이터]
  ├── 각 모듈 완료 알림 수신
  ├── Agent(qa-integrator, run_in_background=false, subagent_type='general-purpose', model='opus')
  │    prompt: "Verify module {X} per cross-boundary-qa checklist. Append findings to _workspace/04_qa_report.md"
  ├── 이슈 발견 시 해당 에이전트에 재호출
  └── 전 모듈 OPEN 이슈 0개가 될 때까지 반복
```

**실행 모드: 서브 에이전트 (qa 단독)**

**중요:** qa-integrator는 반드시 `general-purpose` 타입. `Explore`는 스크립트 실행 불가.

## Phase 4: 통합 릴리스 (팀 모드 재소집)

**활성 팀원:** 전원 (analyst, designer, frontend, backend, qa)

```
[오케스트레이터]
  ├── TeamCreate(name='release', members=[all])
  ├── TaskCreate:
  │    ├── task-05: 통합 빌드 (pnpm build)
  │    ├── task-06: Capacitor sync (apps/mobile)
  │    ├── task-07: OpenAPI 스펙 배포 (packages/shared-types)
  │    └── task-08: 릴리스 노트 작성
  ├── 체크리스트 최종 확인
  └── 완료
```

**실행 모드: 에이전트 팀**

## 데이터 흐름

```
_workspace/
├── 01_analyst_requirements.md     ← product-analyst
├── 02_designer_spec.md            ← ux-designer
├── 03a_frontend_impl.md           ← frontend-engineer
├── 03b_backend_api_contract.md    ← backend-engineer
├── 03b_abuse_prevention.md        ← backend-engineer
└── 04_qa_report.md                ← qa-integrator (append-only)
```

실제 코드 산출물:
```
apps/web/        ← frontend
apps/mobile/     ← frontend (Capacitor)
apps/api/        ← backend
packages/shared-types/   ← backend가 OpenAPI에서 생성
scripts/qa/      ← qa-integrator
```

## 에러 핸들링

| 상황 | 처리 |
|------|------|
| 에이전트 1회 실패 | 1회 재시도 |
| 2회 실패 | `_workspace/04_qa_report.md`에 "에이전트 실패" 항목 추가 + 해당 부분 제외 진행 |
| API 계약 상충 | backend 우선, frontend가 적응. 해결 불가면 analyst 중재 |
| 금액 정책 상충 | analyst의 `01_analyst_requirements.md` 우선 |
| 포트원 API 실패 | 모의 응답으로 대체, 이슈 P0 기록, 실제 키 수령 시 재검증 |

## 테스트 시나리오

### 정상 흐름
```
사용자: "하네스 실행해서 커머스 만들어줘"
→ Phase 0: _workspace 없음 → INITIAL
→ Phase 1: analyst + designer → 01, 02 파일 생성
→ Phase 2: backend → 03b_*, frontend → 03a_* 병렬
→ Phase 3: qa → 각 모듈 검증 → 04 파일
→ Phase 4: 통합 빌드 + 릴리스 노트
→ 사용자에게 피드백 요청
```

### 에러 흐름 (API 계약 상충)
```
Phase 2 중 frontend가 backend의 DTO 필드명 충돌 발견
→ frontend: [frontend→backend] shape mismatch: Product.price vs Product.priceKrw
→ backend: DTO를 priceKrw로 통일, OpenAPI 재생성
→ shared-types 재배포
→ frontend 재빌드
→ 계속
```

### 부분 재실행 흐름
```
사용자: "레퍼럴 엔진만 다시"
→ Phase 0: _workspace 있음 + "다시" 키워드 + "레퍼럴" 지정 → PARTIAL
→ backend-engineer만 재호출 (referral-engine 스킬)
→ qa-integrator가 referral-1m-test, refund-revert-test만 재실행
→ 04 파일에 결과 append
```

## 산출물 체크리스트

- [ ] `_workspace/01_analyst_requirements.md` (MoSCoW, 레퍼럴 정책, 어뷰징 매트릭스)
- [ ] `_workspace/02_designer_spec.md` (토큰 JSON, 와이어프레임, 컴포넌트 카탈로그)
- [ ] `_workspace/03a_frontend_impl.md` + `apps/web/` + `apps/mobile/`
- [ ] `_workspace/03b_backend_api_contract.md` + `apps/api/` + `packages/shared-types/`
- [ ] `_workspace/03b_abuse_prevention.md`
- [ ] `_workspace/04_qa_report.md` (OPEN 이슈 0개)
- [ ] `scripts/qa/` 8종 스크립트
- [ ] 기준 시나리오(1,000,000원 → 30,000 / 50,000 / 170,000) 테스트 통과
- [ ] 셀프레퍼럴 / 순환참조 / 다중계정 차단 테스트 통과
- [ ] Capacitor `cap sync` 성공 (iOS + Android)
- [ ] CLAUDE.md 변경 이력에 이번 실행 기록

## 실행 후 피드백 수집

워크플로우 종료 직전 사용자에게 다음을 질의:
1. "산출물 중 수정하고 싶은 부분?"
2. "팀 구성·워크플로우 변경?"
3. "다음 이터레이션에서 추가할 기능?"

피드백에 따라 CLAUDE.md 변경 이력을 업데이트하고, 필요 시 에이전트/스킬을 수정한다.
