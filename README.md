<p align="center">
  <img src="https://img.shields.io/badge/version-0.1.0-blue.svg" alt="v0.1.0">
  <img src="https://img.shields.io/badge/license-UNLICENSED-lightgrey.svg">
  <img src="https://img.shields.io/badge/stack-Next.js_14_%7C_NestJS_%7C_Capacitor-000">
  <img src="https://img.shields.io/badge/payment-PortOne_V2-FF6B35">
</p>

# Nuxia2 — 커머스 하이브리드앱 × 3세대 레퍼럴

Nuxia 디자인 톤의 모바일 퍼스트 반응형 커머스 웹 + Capacitor iOS/Android 하이브리드앱. **3세대 레퍼럴 수익 분배**(1대 3% / 2대 5% / 3대 17% = 25%) 엔진 포함. 포트원(PortOne V2) 결제 및 본인인증 연동. 셀프레퍼럴·순환참조·다중계정 어뷰징 방지.

## 핵심 기능

- **커머스**: 상품 · 카트 · 주문 · 결제(포트원) · 환불 · 마이페이지
- **레퍼럴 엔진**: 재귀 CTE 기반 3세대 트리, `floor(총액 × bps / 10000)` BigInt 정수 연산, 환불 시 역정산(REVERT) 원장
- **어뷰징 방지**: `ci` UNIQUE + 셀프레퍼럴 체인 검사 + 순환참조 post-insert 검증 + 탈퇴 쿨다운 30일 + STAFF 참여 차단
- **하이브리드앱**: Next.js 정적 export → Capacitor 래핑, 딥링크 `nuxia2://referral/{code}`
- **2단계 인증 (TOTP)** — Google Authenticator, Authy 호환
- **Prometheus /metrics** — 5개 커스텀 카운터 + Node.js 기본 메트릭
- **Audit log** — 관리자 행위 자동 기록

## 아키텍처

```
┌─────────────────┐   ┌──────────────────┐   ┌────────────────┐
│  apps/web       │◀─▶│  apps/api        │◀─▶│  PortOne V2    │
│  Next.js 14     │   │  NestJS 10       │   │  결제 + 본인인증 │
│  Tailwind       │   │  Prisma/Postgres │   └────────────────┘
│  shadcn/ui      │   │  Redis (BullMQ) │
└────────┬────────┘   └──────────────────┘
         │                      ▲
         ▼                      │
┌─────────────────┐   ┌──────────────────┐
│  apps/mobile    │   │ packages/shared- │
│  Capacitor 6    │   │  types (zod)     │
│  iOS + Android  │   └──────────────────┘
└─────────────────┘
```

## 모노레포 구조

```
nuxia2/
├── apps/
│   ├── api/              # NestJS 백엔드 (commerce + referral + payment)
│   │   ├── src/
│   │   │   ├── modules/  # auth, user, product, cart, order, payment, referral, payout, webhook
│   │   │   ├── common/   # filters, interceptors, guards
│   │   │   └── scripts/  # export-openapi.ts 등
│   │   └── prisma/       # schema.prisma (16 models + 9 enums)
│   ├── web/              # Next.js 14 App Router + Tailwind + shadcn/ui
│   │   ├── app/          # route segments (/, /products, /cart, /checkout, /mypage)
│   │   ├── components/   # ui primitives + feature components
│   │   └── design-tokens.json
│   └── mobile/           # Capacitor 6 래퍼 (iOS/Android)
├── packages/
│   └── shared-types/     # zod 스키마 (API 경계 타입 단일 출처)
├── scripts/
│   └── qa/               # cross-boundary QA 스크립트
├── _workspace/           # Phase 1~3 에이전트 산출물
└── .claude/              # 하네스 정의 (agents/, skills/)
```

## 빠른 시작

### 요구 사항
- Node.js >= 20, pnpm >= 9
- Docker Desktop (권장) 또는 PostgreSQL 15+ · Redis 6+ 직접 설치

### Docker Compose로 30초 시작

```bash
git clone https://github.com/hobbong21/nuxia2.git
cd nuxia2
cp .env.docker.example .env
cp apps/api/.env.example apps/api/.env.local   # JWT_SECRET 등 32자 키 교체
make up                                         # postgres + redis 기동
pnpm install
make db-migrate && make db-seed
```

개발 서버 (터미널 2개):
```bash
pnpm --filter @nuxia2/api dev   # http://localhost:4000
pnpm --filter @nuxia2/web dev   # http://localhost:3000
```

단계별 상세·Docker 미사용 수동 설치·에러 해결: [`docs/QUICKSTART.md`](docs/QUICKSTART.md)

### 하이브리드앱 빌드

Capacitor 네이티브 프로젝트 초기화 및 빌드 절차: [`apps/mobile/README.md`](apps/mobile/README.md)

## 레퍼럴 배분 검증 시나리오

3대 유저 D가 1,000,000원 주문 시:

| 세대 | 수혜자 | 비율 | 지급액 |
|------|--------|------|--------|
| 1대 (Direct) | C | 3% | 30,000원 |
| 2대 (Level 2) | B | 5% | 50,000원 |
| 3대 (Level 3) | A | 17% | 170,000원 |
| **합계** | — | **25%** | **250,000원** |

- 환불 시 `REVERT` 원장 생성 → 순액 0
- 구매확정 7일 후 환불은 역정산 생략 (플랫폼 손실 흡수)
- 3세대 초과·상위 추천인 부재는 플랫폼 귀속

## 어뷰징 방지 가드 (6종)

| # | 시나리오 | 구현 위치 |
|---|---------|-----------|
| A1-direct | 본인 직접 추천 | `user.service.ts:createUser` |
| A1-ancestor | 체인 내 동일 `ci` | 재귀 ancestors 조회 |
| A2 | 순환참조 | post-insert `ancestorPath.includes(newId)` |
| A3 | 다중계정 | `User.ciHash @unique` + 애플리케이션 레이어 |
| T5 | 탈퇴 쿨다운 30일 | `withdrawnAt` 체크 |
| T6 | STAFF 참여 차단 | `role in (STAFF, STAFF_FAMILY)` |

자세한 구현 현황: [`_workspace/03b_abuse_prevention.md`](_workspace/03b_abuse_prevention.md)

## 디자인

Nuxia 스타일에서 원리 추출(흰색 베이스, 60px 섹션 수직 리듬, 3열 카드 그리드, lerp 추종), 커머스로 번안. 디자인 토큰 102개는 `apps/web/design-tokens.json`에 저장, Tailwind config에 직접 매핑.

- 모바일 퍼스트 (360px 기본)
- 터치 타겟 44×44 최소
- 레퍼럴 상태 3중 인코딩 (색 + 아이콘 + 라벨)
- confetti/레벨업 이펙트 미사용 (투명성 우선)

디자인 스펙 원본: [`_workspace/02_designer_spec.md`](_workspace/02_designer_spec.md)

## 정책 (T1~T8 확정)

- **T1** 원천징수 3.3% (사업소득 기준)
- **T2** 유보 7일 후 환불은 레퍼럴 역정산 생략
- **T3** 레퍼럴 기준액 = 쿠폰 차감 후 실 결제금액
- **T4** 간편결제 포인트도 현금성으로 인정
- **T5** 탈퇴 후 재가입은 체인 복구 금지, 30일 쿨다운
- **T6** STAFF 및 직계 가족은 레퍼럴 체인 불가
- **T7** 미성년 해제는 관리자 수동만
- **T8** 결손 세대(상위 부재)는 플랫폼 귀속

자세한 내용: [`_workspace/01a_policy_confirmations.md`](_workspace/01a_policy_confirmations.md)

## 라이선스

아직 미확정. 기본 UNLICENSED 상태이며 추후 변경 가능.

## 로드맵

- **v0.2.0**: 실제 마이그레이션 + 시드 + E2E 테스트
- **v0.3.0**: 관리자 페이지 + 정산 자동화
- **v1.0.0**: 프로덕션 론칭

릴리스 노트: [`RELEASE_NOTES_v0.1.0.md`](RELEASE_NOTES_v0.1.0.md) · 전체 변경 이력: [`CHANGELOG.md`](CHANGELOG.md)

## 하네스 기반 개발

이 프로젝트는 [Harness](https://github.com/revfactory/harness) 메타스킬로 생성된 에이전트 5인 팀이 구축했습니다.

- `.claude/agents/` — 5명 에이전트 정의 (product-analyst / ux-designer / frontend-engineer / backend-engineer / qa-integrator)
- `.claude/skills/` — 도메인 스킬 7종 + 오케스트레이터
- `_workspace/` — Phase 1~3 산출물 (요구사항/디자인/구현/QA)

자세한 구조: [`CLAUDE.md`](CLAUDE.md)
