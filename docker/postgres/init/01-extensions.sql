-- Nuxia2 Postgres 초기 확장 설정
-- 주의: 이 스크립트는 신규 볼륨 초기화 시 1회만 실행됨 (docker-entrypoint-initdb.d 관례)

-- pgcrypto: UUID/해시 함수 지원 (Prisma uuid() 기본 동작용은 아니지만 향후 암호학 함수 대비)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 향후 ltree 확장 여부는 referral tree 규모에 따라 결정 (현재는 Adjacent List + 재귀 CTE 기본)
-- CREATE EXTENSION IF NOT EXISTS ltree;
