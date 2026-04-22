# Nuxia2 v0.3.0 — Operations Visibility + Container Reproducibility + CI Gate

**날짜:** 2026-04-21
**이전 릴리스:** [v0.2.0 Local Executable](RELEASE_NOTES_v0.2.0.md)
**태그:** `v0.3.0` (annotated)

## 하이라이트

v0.2가 "로컬 실행 가능"이었다면, v0.3는 **"운영자가 화면으로 보고, 컨테이너로 재현하고, PR마다 CI가 검증"**하는 상태입니다. 3명의 에이전트(frontend, backend, infra)가 병렬로 완료.

### 🛡️ 관리자 화면 (Admin UI skeleton)

4 페이지 + 7 컴포넌트, 기본 다크 테마:

- `/admin` — KPI 카드 4장 (이번 달 어뷰징 차단 / 미지급 정산 NET / 미성년 유보 / 활성 사용자)
- `/admin/abuse-logs` — 테이블 + kind 필터 5종 (셀프/순환/중복 CI/임직원/쿨다운). **AbuseKindBadge** 색+아이콘+라벨 3중 인코딩
- `/admin/users` — 검색 + 상태 필터 목록
- `/admin/users/:id` — 사용자 상세 + 3세대 트리 시각화 + 플래그/미성년 해제 버튼
- `/admin/payouts` — 정산 상태 테이블 (PAID/PENDING/WITHHELD/CLAWBACK_REQUESTED)

**가드:** `apps/web/middleware.ts`가 `/admin/*`에서 `nx_role=ADMIN` 쿠키 검증. `NEXT_PUBLIC_ADMIN_BYPASS=1`로 개발 우회 (프로덕션 빌드에서 무시).

**Mock 백업:** BE 미기동 상태에서도 UI 확인 가능 (`USE_MOCK` 게이트 + 36개 mock 레코드).

### 🐳 컨테이너 재현 (Dockerfile + compose full profile)

- `apps/api/Dockerfile` + `apps/web/Dockerfile` — 각 4 stage (base → deps → build → runtime), `node:20-alpine`, pnpm@9, non-root user (UID 1001), HEALTHCHECK
- `next.config.mjs` HYBRID 분기: `HYBRID_BUILD=1`이면 Capacitor용 export, 기본은 Docker용 standalone
- `docker-compose.yml` full profile 활성화: `docker compose --profile full up`로 api/web/postgres/redis 4개 서비스 즉시 기동
- `/health` + `/health/ready` 엔드포인트: Docker HEALTHCHECK 및 Kubernetes probe 대응

### 🚦 CI 자동화 (GitHub Actions)

- `.github/workflows/ci.yml` 3 job 병렬:
  - **typecheck**: pnpm 설치 후 `pnpm -r run typecheck`
  - **lint**: `pnpm -r run lint`
  - **e2e**: PostgreSQL 16 + Redis 7 service containers → `prisma migrate deploy` → vitest 40 it 실행
- `.github/workflows/docker-build.yml`: main + tag 푸시 시 GHCR로 api/web 이미지 buildx 병렬 푸시 (type=gha cache)

### 🧪 Webhook E2E 테스트 (마지막 잔여 non-blocker 해소)

- `apps/api/test/webhook-portone.test.ts` 6 it:
  1. 유효 HMAC → 200 OK + WebhookEvent 1건
  2. 잘못된 서명 → BadRequest + WebhookEvent 0건
  3. 동일 이벤트 재전송 → `{ ok:true, duplicate:true }` (DB 행 1건 유지)
  4. 같은 paymentId + 다른 eventType → 각각 별개 기록
  5. `ALLOW_UNSIGNED_WEBHOOK=1` + 비프로덕션 → 통과 (dev 토글)
  6. `ALLOW_UNSIGNED_WEBHOOK=1` + `NODE_ENV=production` → 여전히 거부

**테스트 수: 34 → 40 it.** categoryId legacy 분기도 완전 제거.

### 📊 구조화 로그 + correlation-id

- pino 환경 분기 (`NODE_ENV=production` JSON / 그 외 pretty)
- AsyncLocalStorage 기반 correlation-id 인터셉터 — 요청 단위 ID를 모든 로그에 자동 포함
- Node 내장 `crypto.randomUUID()` 사용, 신규 외부 deps는 `pino-pretty` 하나만

## 품질 지표

| 항목 | v0.2 | v0.3 |
|------|------|------|
| 테스트 it 블록 | 34 | **40** (+6 webhook) |
| Admin 라우트 | 0 | **5** |
| Admin 컴포넌트 | 0 | **7** |
| Dockerfile | 0 | **2** (multi-stage) |
| CI 워크플로 | 0 | **2** (ci, docker-build) |
| Legacy fallback | 1 (`categoryId`) | **0** |
| Shared-types typecheck | 1 err | **CLEAN** |

## 실행 확인

### 로컬 전체 스택 (Docker)
```bash
docker compose --profile full up -d
# postgres + redis + api + web 4개 서비스
# http://localhost:3000 (web), http://localhost:4000 (api)
```

### Admin UI 접근 (개발 모드)
```bash
# 옵션 1: 쿠키 세팅
document.cookie = 'nx_role=ADMIN; path=/'
# → http://localhost:3000/admin

# 옵션 2: bypass 플래그
NEXT_PUBLIC_ADMIN_BYPASS=1 pnpm --filter @nuxia2/web dev
```

### CI 확인
- main branch 푸시 또는 PR → Actions 탭에서 3 job 자동 실행
- v1.0.0 태그 푸시 → docker-build.yml이 `ghcr.io/hobbong21/nuxia2-api:v1.0.0`, `-web:v1.0.0` 2종 이미지 푸시

## 프론트엔드 브레이킹 가이드

v0.2에 남아있던 `categoryId` legacy fallback이 제거됐습니다. FE에서 `?categoryId=`를 전송하는 모든 지점은 **필수로** `?categoryName=`으로 수정.

```diff
- const params = { categoryId: cat.id }
+ const params = { categoryName: cat.name }
```

## 다음 릴리스

### v0.4.0 (Production Readiness)
- 실 JWT 세션 ↔ Admin 쿠키 role 가드 통합
- 관리자 2FA (TOTP) UI
- `/metrics` endpoint + Grafana 대시보드
- Audit log 서비스 일관화
- Correlation-id PortOne outbound forward

### v0.3.x (기능 보강, 소규모)
- Cart/checkout 배송지 입력 플로우
- 상품 필터/검색 (categoryName 기반)
- 결제 수단 선택 UI

## 감사

v0.3.0은 `frontend-engineer`, `backend-engineer`, `infra-engineer(general-purpose)` 3명이 서로 **파일 스코프가 완전히 분리된** 상태로 병렬 작업하여 약 25분 내 완성했습니다. 각 에이전트는 다른 에이전트의 진행 중 파일을 읽기만 하고 쓰지 않는 규약(협력 시 충돌 회피)을 준수했습니다.
