# Nuxia2 v0.5.0 — Metrics Wired + AuditLog UI + OTP Backup

**날짜:** 2026-04-21
**이전 릴리스:** [v0.4.0 Admin Connected + 2FA + Observability](RELEASE_NOTES_v0.4.0.md)
**태그:** `v0.5.0` (annotated)

## 하이라이트

v0.4가 관측 인프라를 **정의**했다면, v0.5는 그것을 **실제로 연결**합니다. 관리자는 AuditLog를 UI로 조회하고, 사용자는 TOTP가 없어도 SMS/이메일 OTP로 2단계 인증을 완료할 수 있습니다.

### 📊 Metrics 5 지점 도메인 연결

Prometheus 카운터가 실제 비즈니스 이벤트와 묶임:

```
nuxia2_referral_distribute_total{result} ← distribute() 6 branches
nuxia2_payment_confirm_total{result}      ← confirm() (success|mismatch|failed)
nuxia2_abuse_blocked_total{kind}          ← logAbuse() 일괄 연결
nuxia2_webhook_received_total{source,status} ← webhook handler (ok|duplicate|rejected)
nuxia2_minor_hold_total (gauge)          ← refreshMinorHold() + /metrics scrape
```

**정책:**
- `PaymentService.confirm`의 idempotent replay(`alreadyPaid`) 경로는 카운트하지 않음 — 중복 증가 방지
- `ReferralEngine.distribute`는 전체 try/catch로 감싸 `failed`를 반드시 포착
- 어뷰징 카운터는 `logAbuse` 헬퍼 내부에서 일괄 — 모든 throw 경로 자동 커버

### 📝 관리자 감사 로그 UI

- **Backend:** `GET /admin/audit-logs?kind=&actorUserId=&targetType=&targetId=&cursor=&limit=`
  - keyset 페이지네이션 (createdAt desc, id desc)
  - `actor.nickname` JOIN으로 포함
  - `diffSummary`: before/after JSON 키 차이 요약 (변경 없으면 null)
- **Frontend:** `/admin/audit-logs` 페이지
  - `AuditKindBadge` 6 kind 3중 인코딩 (색+아이콘+라벨)
  - `AuditLogDetailModal` — before/after JSON 뷰어
  - 사이드바에 '감사 로그' 메뉴 추가

### 🔐 OTP 백업 (SMS/이메일)

**Backend:**
- `OtpService` — 60초 쿨다운 + 5회 시도 lockout + 3분 TTL
- `SolapiAdapter` (SMS) + `NodemailerAdapter` (Email) — `OTP_DRY_RUN=1` 모드에서 console.log로 실전 연동 없이 테스트 가능
- `POST /auth/otp/{request,verify}` 엔드포인트
- bcrypt soft-dependency (미설치 시 SHA-256 fallback) — 보안은 TTL+lockout 조합이 주 역할

**Frontend:**
- `OtpChannelPicker` — TOTP | SMS | EMAIL 3 탭
- 로그인 2단계에서 TOTP 대신 OTP로 전환 가능

**데이터 모델:**
- `OtpChallenge` 모델 + `OtpKind` enum (SMS | EMAIL)
- `User.phoneE164` 컬럼 추가
- 마이그레이션: `20260421000002_add_otp_challenge/migration.sql`

### 📈 Grafana + Prometheus 준비

- `docs/grafana-dashboard.json` — 5 패널 (Grafana 10+)
  1. Referral Distribute Rate (timeseries by result)
  2. Payment Confirm by Result (stacked, mismatch 빨강)
  3. Abuse Blocked by Kind (bar gauge, 1h increase)
  4. Webhook Received by Source/Status
  5. Minor Hold Count (stat panel)
- `docs/prometheus-alerts.yml` — 4 룰
  - `PaymentMismatchSpike` (critical) — 5분 내 5건 초과
  - `WebhookRejectedSpike` (warning) — 5분 내 3건 초과
  - `ReferralDistributeFailure` (critical) — 0 초과
  - `MinorHoldGrowth` (info) — 1시간 내 10명 초과

## 품질 지표

| 항목 | v0.4 | v0.5 |
|------|------|------|
| Metrics 도메인 wiring 지점 | 0 (정의만) | **5** |
| Admin BE 엔드포인트 | 8 | **9** (+audit-logs) |
| Admin UI 라우트 | 5 | **6** (+/admin/audit-logs) |
| shared-types 스키마 파일 | 8 | **8** (admin.ts +6 스키마) |
| 2FA 채널 | 1 (TOTP) | **3** (+SMS +EMAIL) |
| Prom 메트릭 커스텀 | 5 (정의) | **5** (wired) |
| Grafana 대시보드 패널 | 0 | **5** |
| Prometheus alert 룰 | 0 | **4** |
| 개발 환경 변수 | +3 (v0.4) | **+12** (v0.5) |

## 실행 확인

### Metrics 증가 확인
```bash
# 1,000,000원 주문 처리 전
curl http://localhost:4000/metrics | grep nuxia2_referral

# 주문 승인 후 확인 — success +3 증가 (3세대 배분)
curl http://localhost:4000/metrics | grep nuxia2_referral
# nuxia2_referral_distribute_total{result="success"} 3
```

### OTP dry-run 테스트
```bash
# 1. 요청
curl -X POST http://localhost:4000/auth/otp/request \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"kind":"SMS"}'
# 응답: { "ok": true, "expiresInSec": 180 }

# 2. API 로그에서 코드 확인
docker compose logs api | grep "OTP dry-run"
# [OTP dry-run] SMS to 010****1234: [Nuxia2] 인증번호는 483291 입니다...

# 3. 검증
curl -X POST http://localhost:4000/auth/otp/verify \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"kind":"SMS","code":"483291"}'
# 응답: { "ok": true }
```

### Admin Audit Log UI
1. `/login` → ADMIN 계정 로그인 → `nx_role=ADMIN` 쿠키 자동
2. `/admin/audit-logs` 접근 → DataTable 렌더링
3. kind 드롭다운으로 USER_FLAG 등 필터링
4. 각 행 클릭 → `AuditLogDetailModal` 열림, before/after JSON 뷰

## 다음 릴리스

### v0.6.0 (Production Launch)
- JWT httpOnly 쿠키 기반 세션 전환
- SMS/Email 상용 공급자 실 연동 (solapi, nodemailer)
- i18n (한국어 외 영어/일어)
- 스토어 업로드 (iOS/Android)
- Capacitor Android CI 워크플로

## 감사

v0.5.0 협력 구조:
- **Infra 서브에이전트** — env 12개, Grafana JSON, Prometheus alerts, docs ✅
- **Frontend 서브에이전트** — AuditLog UI + OtpChannelPicker + Sidebar 메뉴 ✅
- **Backend 메인 세션** — 서브에이전트가 per-file 가드레일을 전체 작업 거부로 오해석하여, 메인 세션에서 직접 수행 (metrics wiring 5지점 + Audit-logs 엔드포인트 + OTP 모듈 전체)

파일 스코프 완전 분리로 3-way 병렬 작업 중 충돌 0건.
