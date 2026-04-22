# Nuxia2 로컬 개발 Makefile
# 참고: Windows 사용자는 Git Bash 또는 WSL에서 실행 권장.
#       make 미설치 시 `choco install make` 또는 아래 명령을 직접 실행.

.PHONY: help up up-full down logs reset db-migrate db-seed db-studio dev build test install

help:         ## 사용 가능한 타겟 표시
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-14s %s\n", $$1, $$2}'

up:           ## postgres + redis 기동 (백그라운드)
	docker compose up -d postgres redis
	@echo ""
	@echo "Postgres: localhost:$${POSTGRES_PORT:-5432}"
	@echo "Redis:    localhost:$${REDIS_PORT:-6379}"

up-full:      ## 모든 서비스 기동 (api + web + db + redis)
	docker compose --profile full up -d

down:         ## 모든 서비스 정지 및 컨테이너 제거 (볼륨 보존)
	docker compose down

logs:         ## 서비스 로그 스트리밍
	docker compose logs -f

reset:        ## 볼륨 포함 전체 삭제 후 재기동 (모든 데이터 삭제)
	docker compose down -v
	docker compose up -d postgres redis

install:      ## 루트 + 워크스페이스 의존성 설치
	pnpm install

db-migrate:   ## 로컬 DB에 Prisma 마이그레이션 적용
	pnpm --filter @nuxia2/api exec prisma migrate dev

db-seed:      ## 개발용 시드 데이터 주입
	pnpm --filter @nuxia2/api exec prisma db seed

db-studio:    ## Prisma Studio 실행 (브라우저 GUI)
	pnpm --filter @nuxia2/api exec prisma studio

dev:          ## api + web dev 서버 안내 (별도 터미널에서 실행 권장)
	@echo "두 개의 터미널에서 각각 실행하세요:"
	@echo "  pnpm --filter @nuxia2/api dev"
	@echo "  pnpm --filter @nuxia2/web dev"

build:        ## 전체 워크스페이스 빌드
	pnpm -r build

test:         ## E2E 테스트 스위트 실행
	pnpm --filter @nuxia2/api test
