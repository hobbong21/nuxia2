/**
 * Admin API client — v0.4 M2 / M6.
 *
 * v0.3: `USE_MOCK=true` 하드코딩.
 * v0.4: `NEXT_PUBLIC_USE_MOCK === '1'` (기본 0 = 실 API).
 *       fetch 호출에 `credentials: 'include'` 로 쿠키 자동 전송.
 *       응답은 zod safeParse 로 런타임 검증.
 *
 * v0.4 동기화: BE가 `shared-types`에 AdminKpiSchema, AdminUserSchema,
 * PaginatedAdminUsersSchema, PaginatedPayoutsSchema를 published. 실 API 분기에서
 * 이 스키마를 직접 사용. Mock 데이터 back-compat을 위한 FE 로컬 adapter 유지.
 */
import { z } from 'zod';
import type {
  Payout,
  User,
  TreeNode,
} from '@nuxia2/shared-types';
import {
  UserRoleSchema,
  UserStatusSchema,
  AdminKpiSchema,
  AdminUserSchema as AdminUserSchemaShared,
  PaginatedAdminUsersSchema as PaginatedAdminUsersSchemaShared,
  PaginatedPayoutsSchema as PaginatedPayoutsSchemaShared,
  TreeNodeSchema,
} from '@nuxia2/shared-types';
import { MOCK_DASHBOARD } from './mock';

// ---------- 환경 / 베이스 ----------

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'https://api.nuxia2.kr';

/**
 * v0.4 M6: mock 게이트는 환경변수 기반.
 *  - 개발 편의: `NEXT_PUBLIC_USE_MOCK=1` → mock
 *  - 프로덕션 빌드(미설정): 실 API 호출
 */
const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === '1';

// ---------- Admin-only 타입 (FE 임시 정의. BE 확정 시 shared-types 로 이전) ----------

export const AbuseKindSchema = z.enum([
  'SELF_REFERRAL',
  'CIRCULAR',
  'DUPLICATE_CI',
  'STAFF_REFERRAL_FORBIDDEN',
  'WITHDRAW_REJOIN_COOLDOWN',
]);
export type AbuseKind = z.infer<typeof AbuseKindSchema>;

// TODO(v0.4-sync): BE가 shared-types에 AbuseLogRowSchema 추가 후 import로 교체
const AbuseLogRowSchema = z.object({
  id: z.string(),
  kind: AbuseKindSchema,
  userId: z.string().nullable(),
  userNickname: z.string().nullable(),
  referrerId: z.string().nullable(),
  referrerNickname: z.string().nullable(),
  reason: z.string(),
  createdAt: z.string(),
});
export type AbuseLogRow = z.infer<typeof AbuseLogRowSchema>;

// TODO(v0.4-sync): BE의 AdminUserSchema 정의를 import
// BE 스펙(10_v0.4.0_sprint.md §M1): email, nickname, role, status, ciMasked, identityVerified,
//   payoutEligibility, flaggedCount, createdAt, lastLoginAt, withdrawnAt
// 현 FE UI 는 referralCode/flagged 를 쓰므로 호환 매핑을 유지한다.
const AdminUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  nickname: z.string(),
  role: UserRoleSchema,
  status: UserStatusSchema,
  // 호환: BE 미발행 시 FE mock 용. BE 는 ciMasked + referralCode 둘 다 허용하도록 협의 예정.
  referralCode: z.string().optional().default(''),
  ciMasked: z.string().optional().default(''),
  flagged: z.boolean().optional().default(false),
  flaggedCount: z.number().int().nonnegative().optional().default(0),
  identityVerified: z.boolean(),
  payoutEligibility: z.boolean().optional().default(true),
  createdAt: z.string(),
  lastLoginAt: z.string().nullable().optional(),
  withdrawnAt: z.string().nullable().optional(),
});
export type AdminUserRow = z.infer<typeof AdminUserSchema>;

// `cursor` 헬퍼는 명시적인 required 타입을 보장한다.
// ZodTypeAny 경로에서 zod 추론이 optional 로 표시되는 edge case를 피하기 위해
// 반환 타입 자체를 직접 기술한다.
function cursor<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    items: z.array(itemSchema),
    nextCursor: z.string().nullable(),
  }) as z.ZodType<{ items: z.infer<T>[]; nextCursor: string | null }>
}

const PaginatedAdminUsersSchema = cursor(AdminUserSchema);
const PaginatedAbuseLogsSchema = cursor(AbuseLogRowSchema);

// TODO(v0.4-sync): BE PayoutSchema 를 shared-types 에서 import
const PayoutRowSchema = z.object({
  id: z.string(),
  userId: z.string(),
  periodStart: z.string(),
  periodEnd: z.string(),
  amountGrossKrw: z.string(),
  amountTaxKrw: z.string(),
  amountNetKrw: z.string(),
  status: z.enum(['PENDING', 'WITHHELD', 'PAID', 'CLAWBACK_REQUESTED', 'CLAWBACK_DONE']),
  bankMaskedAccount: z.string().nullable(),
  paidAt: z.string().nullable(),
});
const PaginatedPayoutsSchema = cursor(PayoutRowSchema);

// v0.4 synced: BE의 AdminKpiSchema (shared-types) 직접 사용.
// FE view model(pendingPayouts/activeUsers)과 필드명 다름 → safeParse 후 매핑.
const AdminKpiWireSchema = AdminKpiSchema;

export interface Cursor<T> {
  items: T[];
  nextCursor: string | null;
}

export interface AdminKpi {
  blockedThisMonth: number;
  pendingPayouts: string; // BigIntString KRW
  minorHoldCount: number;
  activeUsers: number;
}

// ---------- Mock 데이터 ----------

const now = Date.now();
const iso = (offsetMin: number) => new Date(now - offsetMin * 60_000).toISOString();

const MOCK_ABUSE_LOGS: AbuseLogRow[] = [
  { id: 'a01', kind: 'SELF_REFERRAL',            userId: 'u-101', userNickname: '김자기', referrerId: 'u-101', referrerNickname: '김자기', reason: '동일 ci 셀프 참조', createdAt: iso(15) },
  { id: 'a02', kind: 'CIRCULAR',                 userId: 'u-102', userNickname: '박순환', referrerId: 'u-103', referrerNickname: '최역추적', reason: '조상 체인 순환 탐지', createdAt: iso(95) },
  { id: 'a03', kind: 'DUPLICATE_CI',             userId: 'u-104', userNickname: '이중복', referrerId: null, referrerNickname: null, reason: 'hash(ci) UNIQUE 충돌', createdAt: iso(210) },
  { id: 'a04', kind: 'STAFF_REFERRAL_FORBIDDEN', userId: 'u-105', userNickname: '정직원', referrerId: 'u-staff', referrerNickname: '임직원A', reason: 'STAFF/STAFF_FAMILY 추천 금지 (T6)', createdAt: iso(340) },
  { id: 'a05', kind: 'WITHDRAW_REJOIN_COOLDOWN', userId: 'u-106', userNickname: '재가입', referrerId: null, referrerNickname: null, reason: '탈퇴 30일 쿨다운 미경과 (T5)', createdAt: iso(480) },
  { id: 'a06', kind: 'SELF_REFERRAL',            userId: 'u-107', userNickname: '홍길자', referrerId: 'u-107', referrerNickname: '홍길자', reason: 'referralCode === 본인 코드', createdAt: iso(720) },
  { id: 'a07', kind: 'CIRCULAR',                 userId: 'u-108', userNickname: '백순환', referrerId: 'u-109', referrerNickname: '고조상', reason: 'ancestorPath depth=3 자기 포함', createdAt: iso(900) },
  { id: 'a08', kind: 'DUPLICATE_CI',             userId: 'u-110', userNickname: '서중복', referrerId: null, referrerNickname: null, reason: '본인인증 ci 중복', createdAt: iso(1400) },
  { id: 'a09', kind: 'STAFF_REFERRAL_FORBIDDEN', userId: 'u-111', userNickname: '민직원', referrerId: 'u-staff2', referrerNickname: '임직원B', reason: 'STAFF_FAMILY 참여 시도', createdAt: iso(1800) },
  { id: 'a10', kind: 'WITHDRAW_REJOIN_COOLDOWN', userId: 'u-112', userNickname: '재시도', referrerId: null, referrerNickname: null, reason: '5일 전 탈퇴 이력', createdAt: iso(2400) },
  { id: 'a11', kind: 'SELF_REFERRAL',            userId: 'u-113', userNickname: '조셀프', referrerId: 'u-113', referrerNickname: '조셀프', reason: '딥링크 코드 위조', createdAt: iso(3000) },
  { id: 'a12', kind: 'CIRCULAR',                 userId: 'u-114', userNickname: '황순환', referrerId: 'u-115', referrerNickname: '루트', reason: '3뎁스 초과 순환', createdAt: iso(3500) },
  { id: 'a13', kind: 'DUPLICATE_CI',             userId: 'u-116', userNickname: '노중복', referrerId: null, referrerNickname: null, reason: 'encryptCi 중복', createdAt: iso(4000) },
  { id: 'a14', kind: 'STAFF_REFERRAL_FORBIDDEN', userId: 'u-117', userNickname: '배직원', referrerId: 'u-staff3', referrerNickname: '임직원C', reason: '임직원 가족 관계', createdAt: iso(5000) },
  { id: 'a15', kind: 'WITHDRAW_REJOIN_COOLDOWN', userId: 'u-118', userNickname: '변재가', referrerId: null, referrerNickname: null, reason: '쿨다운 21일 경과 필요', createdAt: iso(6000) },
  { id: 'a16', kind: 'SELF_REFERRAL',            userId: 'u-119', userNickname: '문길동', referrerId: 'u-119', referrerNickname: '문길동', reason: 'fingerprint 동일', createdAt: iso(7000) },
  { id: 'a17', kind: 'CIRCULAR',                 userId: 'u-120', userNickname: '장순환', referrerId: 'u-121', referrerNickname: '연결', reason: '역방향 참조', createdAt: iso(8000) },
  { id: 'a18', kind: 'DUPLICATE_CI',             userId: 'u-122', userNickname: '우중복', referrerId: null, referrerNickname: null, reason: 'PortOne ci 재사용', createdAt: iso(9000) },
  { id: 'a19', kind: 'STAFF_REFERRAL_FORBIDDEN', userId: 'u-123', userNickname: '양직원', referrerId: 'u-staff',  referrerNickname: '임직원A', reason: 'STAFF 역할', createdAt: iso(9600) },
  { id: 'a20', kind: 'WITHDRAW_REJOIN_COOLDOWN', userId: 'u-124', userNickname: '오재가', referrerId: null, referrerNickname: null, reason: '7일 전 탈퇴', createdAt: iso(9800) },
];

const MOCK_USERS: AdminUserRow[] = [
  { id: 'u-001', nickname: '홍길동',   email: 'hong@example.com',   role: 'CUSTOMER',     status: 'ACTIVE',      referralCode: 'NX-ABC123', ciMasked: 'hxxxxxxx', flagged: false, flaggedCount: 0, identityVerified: true,  payoutEligibility: true,  createdAt: iso(40000), lastLoginAt: iso(10), withdrawnAt: null },
  { id: 'u-002', nickname: '김영희',   email: 'kim@example.com',    role: 'CUSTOMER',     status: 'ACTIVE',      referralCode: 'NX-KIM001', ciMasked: 'kxxxxxxx', flagged: false, flaggedCount: 0, identityVerified: true,  payoutEligibility: true,  createdAt: iso(38000), lastLoginAt: iso(30), withdrawnAt: null },
  { id: 'u-003', nickname: '이철수',   email: 'lee@example.com',    role: 'CUSTOMER',     status: 'ACTIVE',      referralCode: 'NX-LEE001', ciMasked: 'lxxxxxxx', flagged: false, flaggedCount: 0, identityVerified: true,  payoutEligibility: true,  createdAt: iso(30000), lastLoginAt: iso(55), withdrawnAt: null },
  { id: 'u-004', nickname: '박미성년', email: 'park@example.com',   role: 'CUSTOMER',     status: 'MINOR_HOLD',  referralCode: 'NX-PARK01', ciMasked: 'pxxxxxxx', flagged: true,  flaggedCount: 2, identityVerified: true,  payoutEligibility: false, createdAt: iso(22000), lastLoginAt: iso(120), withdrawnAt: null },
  { id: 'u-005', nickname: '최임원',   email: 'staff@nuxia.kr',     role: 'STAFF',        status: 'ACTIVE',      referralCode: 'NX-STF001', ciMasked: 'cxxxxxxx', flagged: false, flaggedCount: 0, identityVerified: true,  payoutEligibility: false, createdAt: iso(20000), lastLoginAt: iso(5),   withdrawnAt: null },
  { id: 'u-006', nickname: '정수연',   email: 'jung@example.com',   role: 'CUSTOMER',     status: 'ACTIVE',      referralCode: 'NX-JUN001', ciMasked: 'jxxxxxxx', flagged: false, flaggedCount: 0, identityVerified: true,  payoutEligibility: true,  createdAt: iso(15000), lastLoginAt: iso(200), withdrawnAt: null },
  { id: 'u-007', nickname: '강민수',   email: 'kang@example.com',   role: 'CUSTOMER',     status: 'ACTIVE',      referralCode: 'NX-KAN001', ciMasked: 'gxxxxxxx', flagged: false, flaggedCount: 0, identityVerified: true,  payoutEligibility: true,  createdAt: iso(12000), lastLoginAt: iso(400), withdrawnAt: null },
  { id: 'u-008', nickname: '조석영',   email: 'cho@example.com',    role: 'CUSTOMER',     status: 'ACTIVE',      referralCode: 'NX-CHO001', ciMasked: 'cxxxxxxx', flagged: true,  flaggedCount: 1, identityVerified: true,  payoutEligibility: true,  createdAt: iso(8000),  lastLoginAt: iso(900), withdrawnAt: null },
  { id: 'u-009', nickname: '윤태양',   email: 'yoon@example.com',   role: 'CUSTOMER',     status: 'ACTIVE',      referralCode: 'NX-YOO001', ciMasked: 'yxxxxxxx', flagged: false, flaggedCount: 0, identityVerified: false, payoutEligibility: false, createdAt: iso(4000),  lastLoginAt: null,    withdrawnAt: null },
  { id: 'u-010', nickname: '한미정',   email: 'han@example.com',    role: 'CUSTOMER',     status: 'ACTIVE',      referralCode: 'NX-HAN001', ciMasked: 'hxxxxxxx', flagged: false, flaggedCount: 0, identityVerified: true,  payoutEligibility: true,  createdAt: iso(2000),  lastLoginAt: iso(60),  withdrawnAt: null },
];

const MOCK_PAYOUTS: Payout[] = [
  { id: 'c0000000000000000000000001', userId: 'c0000000000000000000000010', periodStart: '2026-03-01T00:00:00Z', periodEnd: '2026-03-31T23:59:59Z', amountGrossKrw: '250000', amountTaxKrw: '8250',  amountNetKrw: '241750', status: 'PAID',               bankMaskedAccount: '1002-***-7890', paidAt: '2026-04-05T03:00:00Z' },
  { id: 'c0000000000000000000000002', userId: 'c0000000000000000000000011', periodStart: '2026-03-01T00:00:00Z', periodEnd: '2026-03-31T23:59:59Z', amountGrossKrw: '180000', amountTaxKrw: '5940',  amountNetKrw: '174060', status: 'PAID',               bankMaskedAccount: '3333-**-12345',  paidAt: '2026-04-05T03:00:00Z' },
  { id: 'c0000000000000000000000003', userId: 'c0000000000000000000000012', periodStart: '2026-04-01T00:00:00Z', periodEnd: '2026-04-30T23:59:59Z', amountGrossKrw: '420000', amountTaxKrw: '13860', amountNetKrw: '406140', status: 'PENDING',            bankMaskedAccount: '1002-***-1111', paidAt: null },
  { id: 'c0000000000000000000000004', userId: 'c0000000000000000000000013', periodStart: '2026-04-01T00:00:00Z', periodEnd: '2026-04-30T23:59:59Z', amountGrossKrw: '68000',  amountTaxKrw: '2244',  amountNetKrw: '65756',  status: 'WITHHELD',           bankMaskedAccount: null,            paidAt: null },
  { id: 'c0000000000000000000000005', userId: 'c0000000000000000000000014', periodStart: '2026-04-01T00:00:00Z', periodEnd: '2026-04-30T23:59:59Z', amountGrossKrw: '95000',  amountTaxKrw: '3135',  amountNetKrw: '91865',  status: 'CLAWBACK_REQUESTED', bankMaskedAccount: '3333-**-22222', paidAt: null },
];

const MOCK_KPI: AdminKpi = {
  blockedThisMonth: MOCK_ABUSE_LOGS.length,
  pendingPayouts: '488005',
  minorHoldCount: 1,
  activeUsers: 8,
};

// ---------- 유틸 ----------

function paginate<T>(all: T[], cursor?: string, limit = 20): Cursor<T> {
  const start = cursor ? Number(cursor) : 0;
  const slice = all.slice(start, start + limit);
  const next = start + limit < all.length ? String(start + limit) : null;
  return { items: slice, nextCursor: next };
}

interface FetchOpts {
  method?: 'GET' | 'POST';
  body?: unknown;
  query?: Record<string, string | number | undefined>;
}

/**
 * Admin fetch 래퍼.
 * - `credentials: 'include'` 로 `nx_role` 쿠키 + JWT 세션 쿠키 자동 전송
 * - `Authorization: Bearer` 는 생략(쿠키 기반). 필요 시 호출부에서 추가.
 * - 4xx/5xx 는 빈 값 + 콘솔 에러 (호출부에서 토스트 표시)
 */
async function adminFetch(path: string, opts: FetchOpts = {}): Promise<unknown> {
  const url = new URL(`${API_BASE}${path}`);
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    }
  }
  const res = await fetch(url.toString(), {
    method: opts.method ?? 'GET',
    credentials: 'include', // v0.4 M2: 쿠키 자동 전송
    headers: opts.body !== undefined
      ? { 'Content-Type': 'application/json' }
      : undefined,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    cache: 'no-store',
  });
  if (!res.ok) {
    // 상위 호출부에서 에러 처리 (토스트 + 빈 목록)
    throw new Error(`admin fetch failed: ${res.status} ${path}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

function emptyCursor<T>(): Cursor<T> {
  return { items: [], nextCursor: null };
}

// ---------- Admin API ----------

export interface GetAbuseLogsParams { kind?: AbuseKind; cursor?: string; limit?: number }
export interface GetUsersParams     { query?: string;   cursor?: string; limit?: number }
export interface GetPayoutsParams   { cursor?: string;  limit?: number }

export const adminApi = {
  async getKpi(): Promise<AdminKpi> {
    if (USE_MOCK) return MOCK_KPI;
    try {
      const json = await adminFetch('/admin/kpi');
      const parsed = AdminKpiWireSchema.safeParse(json);
      if (!parsed.success) {
        console.error('[admin] /admin/kpi schema mismatch', parsed.error.flatten());
        return { blockedThisMonth: 0, pendingPayouts: '0', minorHoldCount: 0, activeUsers: 0 };
      }
      return {
        blockedThisMonth: parsed.data.blockedThisMonth,
        pendingPayouts: parsed.data.pendingPayoutKrw,
        minorHoldCount: parsed.data.minorHoldCount,
        activeUsers: parsed.data.activeUserCount,
      };
    } catch (e) {
      console.error('[admin] getKpi failed', e);
      return { blockedThisMonth: 0, pendingPayouts: '0', minorHoldCount: 0, activeUsers: 0 };
    }
  },

  async getAbuseLogs({ kind, cursor, limit = 20 }: GetAbuseLogsParams = {}): Promise<Cursor<AbuseLogRow>> {
    if (USE_MOCK) {
      const filtered = kind ? MOCK_ABUSE_LOGS.filter((x) => x.kind === kind) : MOCK_ABUSE_LOGS;
      return paginate(filtered, cursor, limit);
    }
    try {
      const json = await adminFetch('/admin/abuse-logs', { query: { kind, cursor, limit } });
      const parsed = PaginatedAbuseLogsSchema.safeParse(json);
      if (!parsed.success) {
        console.error('[admin] /admin/abuse-logs schema mismatch', parsed.error.flatten());
        return emptyCursor();
      }
      return parsed.data;
    } catch (e) {
      console.error('[admin] getAbuseLogs failed', e);
      return emptyCursor();
    }
  },

  async getUsers({ query, cursor, limit = 20 }: GetUsersParams = {}): Promise<Cursor<AdminUserRow>> {
    if (USE_MOCK) {
      const q = query?.trim().toLowerCase();
      const filtered = q
        ? MOCK_USERS.filter(
            (u) =>
              u.nickname.toLowerCase().includes(q) ||
              u.email.toLowerCase().includes(q) ||
              u.referralCode.toLowerCase().includes(q),
          )
        : MOCK_USERS;
      return paginate(filtered, cursor, limit);
    }
    try {
      const json = await adminFetch('/admin/users', { query: { q: query, cursor, limit } });
      const parsed = PaginatedAdminUsersSchema.safeParse(json);
      if (!parsed.success) {
        console.error('[admin] /admin/users schema mismatch', parsed.error.flatten());
        return emptyCursor();
      }
      return parsed.data;
    } catch (e) {
      console.error('[admin] getUsers failed', e);
      return emptyCursor();
    }
  },

  async getUser(id: string): Promise<AdminUserRow | null> {
    if (USE_MOCK) return MOCK_USERS.find((u) => u.id === id) ?? null;
    try {
      const json = await adminFetch(`/admin/users/${encodeURIComponent(id)}`);
      const parsed = AdminUserSchema.safeParse(json);
      if (!parsed.success) {
        console.error('[admin] /admin/users/:id schema mismatch', parsed.error.flatten());
        return null;
      }
      return parsed.data;
    } catch (e) {
      console.error('[admin] getUser failed', e);
      return null;
    }
  },

  async getUserTree(id: string): Promise<TreeNode> {
    if (USE_MOCK) return MOCK_DASHBOARD.tree;
    try {
      const json = await adminFetch(`/admin/users/${encodeURIComponent(id)}/tree`);
      // v0.4 synced: TreeNodeSchema (shared-types) safeParse
      const parsed = TreeNodeSchema.safeParse(json);
      if (!parsed.success) {
        console.error('[admin] /admin/users/:id/tree schema mismatch', parsed.error.flatten());
        return MOCK_DASHBOARD.tree;
      }
      return parsed.data;
    } catch (e) {
      console.error('[admin] getUserTree failed', e);
      return MOCK_DASHBOARD.tree;
    }
  },

  async getPayouts({ cursor, limit = 20 }: GetPayoutsParams = {}): Promise<Cursor<Payout>> {
    if (USE_MOCK) return paginate(MOCK_PAYOUTS, cursor, limit);
    try {
      const json = await adminFetch('/admin/payouts', { query: { cursor, limit } });
      const parsed = PaginatedPayoutsSchema.safeParse(json);
      if (!parsed.success) {
        console.error('[admin] /admin/payouts schema mismatch', parsed.error.flatten());
        return emptyCursor();
      }
      // Payout 타입은 shared-types 와 호환. 필드 매핑 동일.
      return parsed.data as unknown as Cursor<Payout>;
    } catch (e) {
      console.error('[admin] getPayouts failed', e);
      return emptyCursor();
    }
  },

  async flagUser(id: string, body: { flagged: boolean; reason: string }): Promise<{ ok: true }> {
    if (USE_MOCK) {
      const u = MOCK_USERS.find((x) => x.id === id);
      if (u) u.flagged = body.flagged;
      return { ok: true };
    }
    try {
      await adminFetch(`/admin/users/${encodeURIComponent(id)}/flag`, { method: 'POST', body });
      return { ok: true };
    } catch (e) {
      console.error('[admin] flagUser failed', e);
      throw e;
    }
  },

  async releaseMinor(id: string): Promise<{ ok: true }> {
    if (USE_MOCK) {
      const u = MOCK_USERS.find((x) => x.id === id);
      if (u && u.status === 'MINOR_HOLD') u.status = 'ACTIVE';
      return { ok: true };
    }
    try {
      await adminFetch(`/admin/users/${encodeURIComponent(id)}/release-minor`, { method: 'POST' });
      return { ok: true };
    } catch (e) {
      console.error('[admin] releaseMinor failed', e);
      throw e;
    }
  },
};

export type { User, Payout };
