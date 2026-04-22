-- ============================================================================
-- v0.4.0 M5 — 2FA (TOTP) 컬럼 추가 + User.lastLoginAt
-- ============================================================================

ALTER TABLE "User"
  ADD COLUMN "totpSecret"    TEXT,
  ADD COLUMN "totpEnabled"   BOOLEAN    NOT NULL DEFAULT false,
  ADD COLUMN "totpEnabledAt" TIMESTAMP(3),
  ADD COLUMN "lastLoginAt"   TIMESTAMP(3);

-- 조회/정렬용 인덱스 (관리자 KPI: 최근 로그인 사용자 집계 등에서 활용)
CREATE INDEX "User_lastLoginAt_idx" ON "User" ("lastLoginAt");
