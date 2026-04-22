# Nuxia2 v0.2.0 — Local Executable + Automated Verification

**날짜:** 2026-04-21
**이전 릴리스:** [v0.1.0 Foundation](RELEASE_NOTES_v0.1.0.md)
**커밋 수:** 11 (v0.1.0 기준 +2)
**변경 파일:** 47개 (11,645 insertions / 163 deletions)

## 하이라이트

v0.1.0이 **"구조적 기반"**이었다면, v0.2.0은 **"로컬에서 실행 가능하고 자동으로 검증되는 상태"**입니다. 개발자가 clone 직후 `make up && make db-migrate && make db-seed`만으로 동작하는 스택을 손에 쥡니다.

### 🗄️ 실 Prisma 마이그레이션 + 시드

- `prisma/migrations/20260421000000_init/migration.sql` 약 360 라인 — enum 9, 테이블 16, UNIQUE 인덱스 10, 일반 인덱스 17, 외래키 15 전부 포함
- `prisma/seed.ts` — 4대 체인(A→B→C→D) + STAFF 1명 + 상품 10종 + 주문 3건 + 원천징수 설정. 합 23 레코드.
- `prisma db seed` 트리거 자동 연결 (`package.json prisma.seed`)

### 🐳 Docker Compose 로컬 개발 환경

```bash
make up                 # postgres 16 + redis 7 기동 (healthcheck)
make db-migrate         # Prisma 마이그레이션 적용
make db-seed            # 시드 실행
make dev                # api + web 개발 서버 안내
```

- 기본은 DB만, `make up-full`은 api/web 컨테이너까지 (Dockerfile 추가 후 활성)
- 포트 충돌은 `.env`의 `POSTGRES_PORT`로 즉시 조정
- pgcrypto 확장 초기화 포함

### 🧪 vitest E2E 테스트 스위트 (6 파일 / 34 it 블록)

| 파일 | 커버 |
|------|------|
| `referral-engine.test.ts` | 1,000,000원 → 30k/50k/170k, floor 반올림, 환불 역정산, 세대 경계 |
| `payment-confirm.test.ts` | 포트원 금액 검증, idempotent confirm, 금액 불일치 거절 |
| `abuse-self-referral.test.ts` | A1-direct, A1-ancestor 차단 |
| `abuse-circular.test.ts` | A2 순환참조 탐지 |
| `abuse-multi-account.test.ts` | A3 duplicate ci, T5 30일 쿨다운, T6 STAFF 차단 |
| `boundary-shape.test.ts` | API 응답 ↔ shared-types zod 정합성 |

```bash
pnpm --filter @nuxia2/api test:e2e
```

실 DB + 실 Prisma + 실 Service 호출. Mock은 포트원 외부 HTTP만.

### 🔒 잔여 non-blocker 3건 전부 해소 (N1/N2/N3)

- **N1** — `apps/api`가 `@nuxia2/shared-types`를 workspace 의존성으로 import. 로컬 복제된 `ShippingAddressSchema` 삭제됨.
- **N2** — `ProductListQuerySchema.categoryId` → `categoryName` 리네임. 하드코드 null 우회 해소. FE 사이드는 legacy fallback으로 점진 마이그레이션 가능.
- **N3** — `PaymentService.confirm()` idempotent 가드. 재시도 버튼 안전.

### 🔐 JWT Refresh 엔드포인트 (S1)

- `POST /auth/refresh { refreshToken }` → 새 `accessToken` 발급
- `Session` TTL + revoke 검증
- Refresh token rotation (재발급 시 기존 무효)

### 🛡️ Admin API 확장 (S2)

- `GET /admin/abuse-logs?kind&cursor&limit` — 커서 페이지네이션, kind 필터
- `GET /admin/users/:id/tree` — 사용자 기준 3 depth 추천 트리
- `POST /admin/users/:id/flag` — 어뷰징 수동 플래그
- 기존 `release-minor`, `suspend`, `runPayout`과 결합

### 🐛 부수 수정: App Router 충돌 해결

- `apps/web/app/(mypage)/page.tsx`와 `apps/web/app/(shop)/page.tsx`가 모두 `/`로 resolve되어 dev server 부팅 실패 → `(mypage)` → `mypage` 세그먼트로 변경.

## 품질 지표

- **pnpm install**: 823 패키지, lockfile 체크인 완료
- **Next.js dev server**: `pnpm --filter @nuxia2/web dev` 에서 정상 부팅 확인 (화면 렌더링 스크린샷 검증 완료 — 홈/레퍼럴 대시보드/내 트리/가입/초대 6종)
- **테스트 커버리지**: 34 it 블록 / 어뷰징 6종 전부 / 기준 시나리오 PASS (정적)
- **Breaking Changes**: `ProductListQuerySchema` 필드명 1건 (`categoryId` → `categoryName`), legacy fallback 제공

## 실행 확인 예시

### 설치 + 부팅
```bash
git clone https://github.com/hobbong21/nuxia2.git
cd nuxia2
cp .env.docker.example .env
cp apps/api/.env.example apps/api/.env.local  # PortOne 키 등 채우기
pnpm install
make up                                        # postgres + redis healthy 대기
make db-migrate                                # schema.prisma → DB
make db-seed                                   # 4대 체인 + 상품 + 주문
pnpm --filter @nuxia2/api dev  &
pnpm --filter @nuxia2/web dev
# 브라우저에서 http://localhost:3000
```

### E2E 테스트 실행
```bash
make up                                        # DB 준비
pnpm --filter @nuxia2/api test:e2e             # 34개 assertion 실행
```

예상 출력 (docker+migrate 실행 후):
```
 ✓ test/referral-engine.test.ts (9)
   ✓ Referral Engine — 3세대 배분
     ✓ 1,000,000원 주문 시 C=30k / B=50k / A=170k 정확 배분
     ...
 ✓ test/abuse-multi-account.test.ts (6)
   ✓ A3 DUPLICATE_CI + T5 WITHDRAW_REJOIN_COOLDOWN + T6 STAFF_REFERRAL_FORBIDDEN
 ...
```

## 프론트엔드 브레이킹 가이드

FE 코드에서 `categoryId`를 쿼리 파라미터로 전송하는 곳이 있으면 `categoryName`으로 변경하세요:

```diff
- router.push(`/products?categoryId=${categoryId}`)
+ router.push(`/products?categoryName=${categoryName}`)
```

백엔드 `product.controller.ts`에 legacy fallback(`categoryId`를 받아 `categoryName`으로 내부 변환)이 있어 당장 깨지지는 않지만, v0.3에서 제거 예정입니다.

## 다음 릴리스 예정

### v0.3.0 (Admin UI + CI)
- 관리자 화면 skeleton (AbuseLog 테이블, 트리 시각화, 수동 심사 승인)
- `apps/api/Dockerfile` + `apps/web/Dockerfile` (multi-stage)
- GitHub Actions workflow (PG service container + E2E 실행)
- `ltree` 확장 기반 대규모 트리 최적화 (>100k 노드 전제)

### v1.0.0 (프로덕션 전)
- CI/CD 파이프라인
- Observability (로그/메트릭/알림)
- 스테이징 실사용 테스트 + 부하 테스트

## 감사

v0.2.0은 `backend-engineer`, `qa-integrator`, `infra-engineer(general-purpose)` 3명의 AI 에이전트가 완전 병렬로 작업하여 약 20분 내 완성했습니다. Harness 메타스킬 기반 자율 협업의 두 번째 사이클입니다.
