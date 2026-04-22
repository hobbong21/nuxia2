# Nuxia2 — 로컬 개발 빠른 시작 (Quickstart)

이 문서는 `README.md`의 "빠른 시작" 섹션을 단계별로 확장한 실전 가이드입니다. **Docker Compose 기반 30초 시작**을 기본으로 안내하며, docker 미사용 환경을 위한 수동 설치도 함께 다룹니다.

---

## 30초 시작 (권장: Docker Compose)

사전 조건: **Node.js 20+**, **pnpm 9+**, **Docker Desktop** (또는 호환 Docker Engine + compose plugin)

```bash
# 1. 저장소 클론
git clone https://github.com/hobbong21/nuxia2.git
cd nuxia2

# 2. 환경 변수 파일 복사
cp .env.docker.example .env
cp apps/api/.env.example apps/api/.env.local
# apps/api/.env.local 에서 JWT_SECRET 등 32자 이상 키로 교체

# 3. 인프라 컨테이너 기동 (postgres + redis)
make up
# make 미설치 시: docker compose up -d postgres redis

# 4. 의존성 설치
pnpm install

# 5. DB 마이그레이션 + 시드
make db-migrate
make db-seed

# 6. 개발 서버 기동 (터미널 2개)
pnpm --filter @nuxia2/api dev   # 터미널 1: http://localhost:4000
pnpm --filter @nuxia2/web dev   # 터미널 2: http://localhost:3000
```

**포트 점유 현황 확인:**
- PostgreSQL: `localhost:5432` (변경: `.env`의 `POSTGRES_PORT`)
- Redis: `localhost:6379` (변경: `.env`의 `REDIS_PORT`)
- API: `localhost:4000`
- Web: `localhost:3000`
- Swagger UI: `localhost:4000/api-docs`

---

## Makefile 타겟 치트시트

```
make up          # postgres + redis 만 기동
make up-full     # api + web 포함 전체 기동 (프로필)
make down        # 정지 (볼륨 보존)
make reset       # 볼륨까지 삭제하고 재기동 (데이터 초기화)
make logs        # 로그 스트리밍
make db-migrate  # Prisma 마이그레이션 적용
make db-seed     # 시드 데이터 주입
make db-studio   # Prisma Studio 실행
make test        # E2E 테스트
```

`make help`로 전체 타겟 목록 확인.

---

## 환경 변수 상세

### 루트 `.env` (Docker Compose 전용)

`docker-compose.yml`이 자동으로 읽어들이며, 컨테이너 외부에서는 사용되지 않습니다.

| 키 | 기본값 | 의미 |
|-----|--------|------|
| `POSTGRES_DB` | `nuxia2` | 초기 생성될 DB 이름 |
| `POSTGRES_USER` | `nuxia2` | 슈퍼유저 이름 |
| `POSTGRES_PASSWORD` | `nuxia2_dev` | 슈퍼유저 비밀번호 (dev only) |
| `POSTGRES_PORT` | `5432` | 호스트 포트 매핑 |
| `REDIS_PORT` | `6379` | 호스트 포트 매핑 |

### `apps/api/.env.local` (API 런타임)

`apps/api/.env.example`을 복사해서 사용. 필수 필드:

| 키 | 예시 값 | 의미 |
|-----|---------|------|
| `DATABASE_URL` | `postgresql://nuxia2:nuxia2_dev@localhost:5432/nuxia2?schema=public` | Postgres 접속 문자열 |
| `REDIS_URL` | `redis://localhost:6379` | BullMQ 큐 / 세션 스토리지 |
| `JWT_SECRET` | 32자 이상 랜덤 문자열 | **32자 미만이면 서버 부팅 실패** |
| `PORTONE_API_SECRET` | 포트원 콘솔 발급 | 서버측 결제 검증 |
| `PORTONE_WEBHOOK_SECRET` | 포트원 콘솔 발급 | Webhook HMAC 서명 검증 |
| `PORTONE_STORE_ID` | `store-xxx` | 포트원 상점 식별자 |
| `APP_ENCRYPTION_KEY` | AES-256 키 (32바이트 hex) | 본인인증 `ci` 암호화 |

32자 랜덤 문자열 생성 예:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**주의**: `.env` 기본값과 `apps/api/.env.local`의 `DATABASE_URL` 사용자/비밀번호가 일치해야 합니다. 기본값 기준 `nuxia2:nuxia2_dev@localhost:5432/nuxia2`.

---

## 수동 설치 (Docker 미사용)

Docker를 쓰기 어려운 환경을 위한 참고용입니다.

### 0. 체크리스트

| 도구 | 최소 버전 | 설치 확인 명령 |
|------|-----------|---------------|
| Node.js | 20.x | `node -v` |
| pnpm | 9.x | `pnpm -v` |
| PostgreSQL | 15+ | `psql --version` |
| Redis | 6+ | `redis-cli --version` |
| Git | 임의 | `git --version` |

### Windows
- **Node.js / pnpm**: [nodejs.org](https://nodejs.org/) LTS 설치 후 `corepack enable`
- **PostgreSQL**: [EDB 공식 installer](https://www.postgresql.org/download/windows/). 설치 시 비밀번호 기억
- **Redis**: WSL2 권장 (`sudo apt install redis-server`) 또는 [Memurai](https://www.memurai.com/)

### macOS
```bash
brew install node@20 postgresql@16 redis
brew services start postgresql@16
brew services start redis
corepack enable
```

### Linux (Debian/Ubuntu)
```bash
sudo apt update
sudo apt install -y postgresql redis-server
sudo systemctl enable --now postgresql redis-server
corepack enable
```

### DB 사용자/DB 생성

```bash
# macOS/Linux
createuser --pwprompt nuxia2
createdb -O nuxia2 nuxia2

# Windows (psql.exe)
psql -U postgres -c "CREATE USER nuxia2 WITH PASSWORD 'nuxia2_dev';"
psql -U postgres -c "CREATE DATABASE nuxia2 OWNER nuxia2;"
```

이후 `30초 시작` 4번 단계부터 동일하게 진행하면 됩니다.

---

## 자주 발생하는 에러

### Docker 관련

#### `Error: Port 5432 already in use`
호스트에 기존 Postgres가 실행 중입니다. 둘 중 하나:
- 기존 Postgres 중단: `sudo systemctl stop postgresql` / `brew services stop postgresql`
- `.env`의 `POSTGRES_PORT=5433`으로 변경 → `DATABASE_URL`의 포트도 `5433`으로 수정

#### `Cannot connect to the Docker daemon`
Docker Desktop이 실행 중이 아닙니다.
- Windows/macOS: Docker Desktop 애플리케이션 실행
- Linux: `sudo systemctl start docker`

#### `healthcheck failed` 또는 `dependency failed to start`
의존 서비스가 healthy 상태에 도달하지 못한 경우. 로그 확인:
```bash
docker compose logs postgres
docker compose logs redis
```
볼륨 충돌이 의심되면 `make reset` (데이터 초기화).

### 애플리케이션 관련

#### `[nuxia/api] missing required env: JWT_SECRET, ...`
`.env.local`이 제대로 로드되지 않았거나 값이 비었습니다. `apps/api/.env.local` 경로와 필드를 확인하세요.

#### `[nuxia/api] JWT_SECRET must be at least 32 characters.`
개발 중이라도 32자 이상이 강제됩니다. 위 명령으로 새 키 생성.

#### `Error: P1001: Can't reach database server at localhost:5432`
Postgres가 실행 중이 아닙니다. `docker compose ps`로 상태 확인 후 `make up`.

#### `ECONNREFUSED 127.0.0.1:6379`
Redis가 실행 중이 아닙니다. `make up` 또는 수동 기동.

#### `Prisma schema drift`
기존 로컬 DB에 다른 스키마가 있을 때. 개발 환경이라면 `make reset` 후 `make db-migrate`로 초기화 가능 (**모든 데이터 삭제**).

#### Next.js dev 서버가 API 호출 시 CORS 에러
`apps/api`의 CORS 설정이 `http://localhost:3000`을 허용하는지 확인.

---

## v0.4 새 환경 변수

### Backend
- `ADMIN_API_KEY` — (선택) 관리자 API 2단 가드. 설정 시 `/admin/*` 요청에 `X-Admin-Api-Key` 헤더 필수.
- `METRICS_INTERNAL_SECRET` — 프로덕션 `/metrics` 엔드포인트 접근 제어.
- `TOTP_ISSUER` — Google Authenticator 등에 표시될 이름.

### Frontend
- `NEXT_PUBLIC_USE_MOCK` — `1`로 설정하면 admin-client가 mock 데이터 반환 (BE 미기동 시 UI 확인용).

### 2FA 활성화
1. 로그인 후 `/mypage/security` 이동
2. "2단계 인증 설정" 클릭 → QR 스캔 → 6자리 코드 입력
3. 다음 로그인부터 2단계 코드 요구

### /metrics 접근
- 개발: `curl http://localhost:4000/metrics` (공개)
- 프로덕션: `curl -H "X-Internal-Secret: <값>" https://api.nuxia2.kr/metrics`

---

## 다음 단계

- 하이브리드앱 빌드: [`apps/mobile/README.md`](../apps/mobile/README.md)
- QA 시나리오 실행: `scripts/qa/` (v0.2.0)
- API 계약 참조: [`_workspace/03b_backend_api_contract.md`](../_workspace/03b_backend_api_contract.md)
