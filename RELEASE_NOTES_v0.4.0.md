# Nuxia2 v0.4.0 — Admin Connected + 2FA + Observability

**날짜:** 2026-04-21
**이전 릴리스:** [v0.3.0 Operations + Container + CI](RELEASE_NOTES_v0.3.0.md)
**태그:** `v0.4.0` (annotated)

## 하이라이트

v0.3의 관리자 UI skeleton이 **실제 백엔드와 연동**되고, **2FA / 세션 / 관측성**이 프로덕션 전 수준으로 완성됩니다. 3 에이전트(backend / frontend / infra) 병렬 약 12분 완성.

### 🔌 Admin BE API 완성 (FE mock 제거)

v0.3 때 FE가 요구했던 5개 엔드포인트를 모두 구현:

| FE 메서드 | BE 엔드포인트 | 응답 |
|-----------|--------------|------|
| `getKpi()` | `GET /admin/kpi` | `AdminKpiSchema` (이번 달 어뷰징/미지급 정산/미성년 유보/활성 사용자) |
| `getUsers(...)` | `GET /admin/users?query=&cursor=` | `PaginatedAdminUsersSchema` (iLike 검색) |
| `getUser(id)` | `GET /admin/users/:id` | `AdminUserSchema` (ciMasked + flaggedCount) |
| `getUserTree(id)` | `GET /admin/users/:id/tree` (기존 재사용) | `TreeNodeSchema` |
| `getPayouts()` | `GET /admin/payouts?cursor=` | `PaginatedPayoutsSchema` |

FE `admin-client.ts`는 `NEXT_PUBLIC_USE_MOCK` 환경변수 게이트 + 5 메서드 zod `safeParse`로 전환. BE 미기동 시 mock 자동 폴백.

### 🔐 2FA (TOTP) End-to-End

**Backend:**
- `otplib` + `qrcode` 기반 `totp.service`
- Prisma 스키마: `User.totpSecret`(암호화) / `totpEnabled` / `totpEnabledAt`
- 4 엔드포인트: `/auth/2fa/{setup,verify,disable,login}`

**Frontend:**
- `TotpField` 컴포넌트 — 6자리 숫자, paste 지원, 6자리 완성 시 자동 제출
- `TotpSetupModal` — QR 코드 표시 → 코드 입력 → 활성
- `TotpDisableModal` — 현재 코드 필요
- `/mypage/security` — 상태 카드 (비활성/활성 + 설정일)
- 로그인 페이지 1→2단계 자동 전환 (`needsTotp: true` 응답 분기)

**DB 마이그레이션:** `20260421000001_add_totp/migration.sql` 포함

### 📊 Prometheus /metrics

5 커스텀 메트릭 + Node.js 기본 메트릭:

```
# Counters
nuxia2_referral_distribute_total{result="success|skipped|failed"}
nuxia2_payment_confirm_total{result="success|mismatch|failed"}
nuxia2_abuse_blocked_total{kind="SELF_REFERRAL|CIRCULAR|..."}
nuxia2_webhook_received_total{source="portone",status="ok|duplicate|rejected"}

# Gauge
nuxia2_minor_hold_total
```

프로덕션은 `X-Internal-Secret` 헤더 가드 (env `METRICS_INTERNAL_SECRET`).

### 📝 Audit Log 인프라

- `@Audit('KIND')` 데코레이터 + `AuditLogInterceptor`로 관리자 행위 자동 기록
- 6 엔드포인트 커버: USER_FLAG, USER_MARK_STAFF, USER_SUSPEND, USER_RELEASE_MINOR, PAYOUT_RUN, PAYOUT_RELEASE

### 🍪 JWT 세션 ↔ 관리자 쿠키

로그인 성공 시 `role === 'ADMIN'`이면 `Set-Cookie: nx_role=ADMIN; HttpOnly; SameSite=Lax` 자동 발행. 프로덕션은 `Secure` 추가. FE middleware 가드와 완전 연동.

### 🧪 테스트 **40 → 51 it** (+11)

- `admin-api.test.ts` 4 (KPI / users / user detail / payouts)
- `totp.test.ts` 3 (setup → verify → disable)
- `metrics.test.ts` 2 (counter 증가)
- `audit-log.test.ts` 2 (flag 후 AuditLog 생성)

### 🔗 Correlation-id Outbound Forward

`portone.client`의 모든 HTTP 호출에 `X-Request-Id` 헤더 자동 주입 (AsyncLocalStorage 재사용). 외부 장애 시 req id 기반 역추적 가능.

### 🛡️ X-Admin-Api-Key 가드 (Optional)

`ADMIN_API_KEY` 환경변수 설정 시 모든 `/admin/*`에 2단 가드 (JWT role 외에 API 키).

## 품질 지표

| 항목 | v0.3 | v0.4 |
|------|------|------|
| 테스트 it | 40 | **51** (+11) |
| Admin BE 엔드포인트 | 기존 4 (flag/release-minor/mark-staff/suspend) | +4 (kpi/users/user/payouts) **= 8** |
| shared-types 스키마 파일 | 7 | **8** (+admin.ts) |
| 2FA 엔드포인트 | 0 | **4** |
| Prom 메트릭 | 0 | **5 custom + Node defaults** |
| Audit-wrapped 엔드포인트 | 0 | **6** |

## 실행 확인

### 개발 (BE 포함)
```bash
docker compose --profile full up -d  # postgres + redis + api + web
# http://localhost:3000 (web)
# http://localhost:4000 (api), /metrics, /health, /health/ready
```

### 2FA 활성화
1. 로그인 후 `/mypage/security` 이동
2. "2단계 인증 설정" → QR 스캔 (Google Authenticator) → 6자리 입력
3. 다음 로그인부터 2단계 코드 요구

### Metrics 확인
```bash
# 개발
curl http://localhost:4000/metrics

# 프로덕션
curl -H "X-Internal-Secret: $METRICS_INTERNAL_SECRET" https://api.nuxia2.kr/metrics
```

### Admin UI 실 데이터
```bash
# BE + PG가 떠있으면
NEXT_PUBLIC_USE_MOCK=0 pnpm --filter @nuxia2/web dev
# /admin 접근 시 실제 API 호출
```

## 프론트엔드 주의

- `LoginResponse`가 유니언 (`AuthResponse | { needsTotp, userId }`). 로그인 직후 `needsTotp` 체크 필수.
- `admin-client`는 `credentials: 'include'`로 쿠키를 자동 전송. CORS 설정 시 `credentials: true` 필수.

## 다음 릴리스

### v0.5.0 (Observability 연결 + Audit UI)
- `metrics.inc*()`를 실제 도메인 서비스(referral engine, payment service, webhook)에서 호출
- Admin UI에 AuditLog 조회 화면 (`/admin/audit-logs`)
- 백업용 SMS/이메일 OTP (TOTP 보조)
- i18n (영어/일어)
- 관리자 2FA 활성 강제 정책

### v1.0.0 (Production)
- 실제 스테이징 배포 + 부하 테스트
- Alertmanager 연결 (metrics → Slack/PagerDuty)
- WAF + DDoS 방어

## 감사

v0.4.0 3 에이전트 병렬 완성:
- `backend-engineer` — Admin BE API, metrics, audit, TOTP, JWT 쿠키 (24 파일)
- `frontend-engineer` — 2FA UI, admin real API, login 2단계 (9 파일)
- `infra-engineer(general-purpose)` — env, CI, docker-compose, docs, README (6 파일)

파일 스코프를 read-only / write-only 완전 분리하여 병렬 작업 중 충돌 0건.
