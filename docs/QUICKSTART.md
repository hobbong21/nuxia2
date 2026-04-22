# Nuxia2 — 로컬 개발 빠른 시작 (Quickstart)

이 문서는 `README.md`의 "빠른 시작" 섹션을 단계별로 확장한 실전 가이드입니다. Docker Compose 없이 로컬 서비스(PostgreSQL + Redis)를 직접 설치하는 흐름을 기본으로 안내합니다.

---

## 0. 체크리스트 (한 번만 설치)

| 도구 | 최소 버전 | 설치 확인 명령 |
|------|-----------|---------------|
| Node.js | 20.x | `node -v` |
| pnpm | 9.x | `pnpm -v` |
| PostgreSQL | 15+ | `psql --version` |
| Redis | 6+ | `redis-cli --version` |
| Git | 임의 | `git --version` |

### Windows
- **Node.js / pnpm**: [nodejs.org](https://nodejs.org/) LTS 설치 후 `corepack enable`로 pnpm 활성화
- **PostgreSQL**: [EDB 공식 installer](https://www.postgresql.org/download/windows/) 사용. 설치 시 슈퍼유저 비밀번호 기억할 것
- **Redis**: WSL2 권장 (`sudo apt install redis-server`) 또는 [Memurai](https://www.memurai.com/) 같은 Windows 포트

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
# Node는 nvm 또는 volta 사용 권장
corepack enable
```

---

## 1. 저장소 클론 & 의존성 설치

```bash
git clone https://github.com/hobbong21/nuxia2.git
cd nuxia2
pnpm install
```

`pnpm install`은 루트 + 모든 workspace(`apps/*`, `packages/*`)를 한 번에 설치합니다.

---

## 2. 데이터베이스 준비

로컬 Postgres에 전용 사용자와 DB를 생성합니다.

```bash
# macOS/Linux
createuser --pwprompt nuxia
createdb -O nuxia nuxia_dev

# Windows (psql.exe로)
psql -U postgres -c "CREATE USER nuxia WITH PASSWORD 'nuxia';"
psql -U postgres -c "CREATE DATABASE nuxia_dev OWNER nuxia;"
```

---

## 3. 환경변수 파일 작성

```bash
cp apps/api/.env.example apps/api/.env.local
```

필수 필드 의미:

| 키 | 예시 값 | 의미 |
|-----|---------|------|
| `DATABASE_URL` | `postgresql://nuxia:nuxia@localhost:5432/nuxia_dev?schema=public` | Postgres 접속 문자열. Prisma가 사용 |
| `REDIS_URL` | `redis://localhost:6379` | BullMQ 큐 / 세션 스토리지 |
| `JWT_SECRET` | 32자 이상 랜덤 문자열 | 액세스 토큰 서명. **32자 미만이면 서버 부팅 실패** |
| `PORTONE_API_SECRET` | 포트원 콘솔 발급 | 서버측 결제 검증. 개발 중엔 테스트 키 사용 가능 |
| `PORTONE_WEBHOOK_SECRET` | 포트원 콘솔 발급 | Webhook HMAC 서명 검증 |
| `PORTONE_STORE_ID` | `store-xxx` | 포트원 상점 식별자 |
| `PORTONE_CHANNEL_KEY` | `channel-key-xxx` | 결제 채널 키 |
| `CI_ENCRYPTION_KEY` | AES-256 키 (32바이트 hex) | 본인인증 `ci` 암호화 |
| `CI_HMAC_KEY` | HMAC 키 (32바이트 hex) | `ci` UNIQUE 검색용 deterministic 해시 |
| `ADMIN_EMAIL` | `admin@nuxia2.app` | 관리자 계정 이메일 |

32자 랜덤 문자열 생성 예:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 4. Prisma 마이그레이션 & 클라이언트 생성

```bash
pnpm --filter @nuxia/api exec prisma generate
pnpm --filter @nuxia/api exec prisma migrate dev
```

`prisma migrate dev`는 v0.1.0 시점에는 아직 실제 마이그레이션 파일이 없으므로 **v0.2.0 예정**입니다. 현재는 `prisma db push`로 스키마만 밀어넣을 수 있습니다:

```bash
pnpm --filter @nuxia/api exec prisma db push
```

### 시드 데이터 (선택)

```bash
pnpm --filter @nuxia/api exec prisma db seed
```

v0.1.0 기준 시드 스크립트는 아직 최소(관리자 1명 + 샘플 상품 몇 개) 수준이며 v0.2.0에서 보강 예정입니다. 지금은 수동으로 SQL/Prisma Studio로 데이터를 넣어도 됩니다.

Prisma Studio로 테이블 확인:
```bash
pnpm --filter @nuxia/api exec prisma studio
```

---

## 5. 개발 서버 실행

```bash
# 터미널 1: API (포트 4000)
pnpm --filter @nuxia/api dev

# 터미널 2: Web (포트 3000)
pnpm --filter @nuxia2/web dev
```

접속:
- 웹 앱: http://localhost:3000
- API: http://localhost:4000/api
- Swagger: http://localhost:4000/api-docs

---

## 6. 자주 발생하는 에러

### ❌ `[nuxia/api] missing required env: JWT_SECRET, ...`
`.env.local`이 제대로 로드되지 않았거나 값이 비었습니다. `apps/api/.env.local` 경로와 필드를 다시 확인하세요.

### ❌ `[nuxia/api] JWT_SECRET must be at least 32 characters.`
개발 중이라도 32자 이상이 강제됩니다. 위 2번째 섹션의 생성 커맨드로 새 키를 생성하세요.

### ❌ `Error: P1001: Can't reach database server at localhost:5432`
Postgres가 실행 중이 아닙니다.
- macOS: `brew services start postgresql@16`
- Linux: `sudo systemctl start postgresql`
- Windows: 서비스 관리자에서 `postgresql-x64-16` 시작

### ❌ `ECONNREFUSED 127.0.0.1:6379`
Redis가 실행 중이 아닙니다. 플랫폼별 기동 커맨드를 참조.

### ❌ `Prisma schema drift: database schema is not empty`
로컬 DB에 다른 스키마가 이미 있는 경우. 개발 환경이면 `prisma migrate reset`으로 초기화 가능(**모든 데이터 삭제**).

### ❌ Next.js dev 서버가 API 호출 시 CORS 에러
`apps/api`의 CORS 설정이 `http://localhost:3000`을 허용하는지 확인. v0.1.0 기본값은 허용되어 있어야 함.

---

## 7. 다음 단계

- 하이브리드앱 빌드: [`apps/mobile/README.md`](../apps/mobile/README.md)
- QA 시나리오 실행: `scripts/qa/` (v0.2.0 예정)
- API 계약 참조: [`_workspace/03b_backend_api_contract.md`](../_workspace/03b_backend_api_contract.md)
