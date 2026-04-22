/**
 * Admin API client — v0.3 M1.
 *
 * 백엔드 미기동이거나 `NEXT_PUBLIC_ADMIN_USE_MOCK=1` 일 때는 목 데이터를 반환한다.
 * 실제 BE 가 준비되면 `adminApi` 의 각 메서드를 `api.get/post` 로 스왑하면 된다.
 */
import { z } from 'zod';
import type {
  Payout,
  User,
  UserStatus,
  UserRole,
  TreeNode,
} from '@nuxia2/shared-types';
import { MOCK_DASHBOARD } from './mock';

// ---------- Admin-only 타입 (FE 임시 정의. 확정 시 shared-types 로 이전) ----------

export const AbuseKindSchema = z.enum([
  'SELF_REFERRAL',
  'CIRCULAR',
  'DUPLICATE_CI',
  'STAFF_REFERRAL_FORBIDDEN',
  'WITHDRAW_REJOIN_COOLDOWN',
]);
export type AbuseKind = z.infer<typeof AbuseKindSchema>;

export interface AbuseLogRow {
  id: string;
  kind: AbuseKind;
  userId: string | null;
  userNickname: string | null;
  referrerId: string | null;
  referrerNickname: string | null;
  reason: string;
  createdAt: string;
}

export interface AdminUserRow {
  id: string;
  nickname: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  referralCode: string;
  flagged: boolean;
  identityVerified: boolean;
  createdAt: string;
}

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
  { id: 'u-001', nickname: '홍길동',   email: 'hong@example.com',   role: 'CUSTOMER',     status: 'ACTIVE',      referralCode: 'NX-ABC123', flagged: false, identityVerified: true,  createdAt: iso(40000) },
  { id: 'u-002', nickname: '김영희',   email: 'kim@example.com',    role: 'CUSTOMER',     status: 'ACTIVE',      referralCode: 'NX-KIM001', flagged: false, identityVerified: true,  createdAt: iso(38000) },
  { id: 'u-003', nickname: '이철수',   email: 'lee@example.com',    role: 'CUSTOMER',     status: 'ACTIVE',      referralCode: 'NX-LEE001', flagged: false, identityVerified: true,  createdAt: iso(30000) },
  { id: 'u-004', nickname: '박미성년', email: 'park@example.com',   role: 'CUSTOMER',     status: 'MINOR_HOLD',  referralCode: 'NX-PARK01', flagged: true,  identityVerified: true,  createdAt: iso(22000) },
  { id: 'u-005', nickname: '최임원',   email: 'staff@nuxia.kr',     role: 'STAFF',        status: 'ACTIVE',      referralCode: 'NX-STF001', flagged: false, identityVerified: true,  createdAt: iso(20000) },
  { id: 'u-006', nickname: '정수연',   email: 'jung@example.com',   role: 'CUSTOMER',     status: 'ACTIVE',      referralCode: 'NX-JUN001', flagged: false, identityVerified: true,  createdAt: iso(15000) },
  { id: 'u-007', nickname: '강민수',   email: 'kang@example.com',   role: 'CUSTOMER',     status: 'ACTIVE',      referralCode: 'NX-KAN001', flagged: false, identityVerified: true,  createdAt: iso(12000) },
  { id: 'u-008', nickname: '조석영',   email: 'cho@example.com',    role: 'CUSTOMER',     status: 'ACTIVE',      referralCode: 'NX-CHO001', flagged: true,  identityVerified: true,  createdAt: iso(8000) },
  { id: 'u-009', nickname: '윤태양',   email: 'yoon@example.com',   role: 'CUSTOMER',     status: 'ACTIVE',      referralCode: 'NX-YOO001', flagged: false, identityVerified: false, createdAt: iso(4000) },
  { id: 'u-010', nickname: '한미정',   email: 'han@example.com',    role: 'CUSTOMER',     status: 'ACTIVE',      referralCode: 'NX-HAN001', flagged: false, identityVerified: true,  createdAt: iso(2000) },
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
  pendingPayouts: '488005', // WITHHELD + PENDING net 합계 근사
  minorHoldCount: 1,
  activeUsers: 8,
};

// ---------- 유틸: 커서 페이지네이션 (mock) ----------

function paginate<T>(all: T[], cursor?: string, limit = 20): Cursor<T> {
  const start = cursor ? Number(cursor) : 0;
  const slice = all.slice(start, start + limit);
  const next = start + limit < all.length ? String(start + limit) : null;
  return { items: slice, nextCursor: next };
}

// ---------- Admin API (mock-first) ----------

const USE_MOCK = true; // v0.3 M1: BE 엔드포인트 확정 전까지 항상 mock. (실 연결 시 env/feature flag 로)

export interface GetAbuseLogsParams { kind?: AbuseKind; cursor?: string; limit?: number }
export interface GetUsersParams     { query?: string;   cursor?: string; limit?: number }
export interface GetPayoutsParams   { cursor?: string;  limit?: number }

export const adminApi = {
  async getKpi(): Promise<AdminKpi> {
    if (USE_MOCK) return MOCK_KPI;
    // TODO: return api.get('/admin/kpi', AdminKpiSchema, { token });
    throw new Error('not implemented');
  },

  async getAbuseLogs({ kind, cursor, limit = 20 }: GetAbuseLogsParams = {}): Promise<Cursor<AbuseLogRow>> {
    if (USE_MOCK) {
      const filtered = kind ? MOCK_ABUSE_LOGS.filter((x) => x.kind === kind) : MOCK_ABUSE_LOGS;
      return paginate(filtered, cursor, limit);
    }
    throw new Error('not implemented');
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
    throw new Error('not implemented');
  },

  async getUser(id: string): Promise<AdminUserRow | null> {
    if (USE_MOCK) return MOCK_USERS.find((u) => u.id === id) ?? null;
    throw new Error('not implemented');
  },

  async getUserTree(_id: string): Promise<TreeNode> {
    if (USE_MOCK) return MOCK_DASHBOARD.tree;
    throw new Error('not implemented');
  },

  async getPayouts({ cursor, limit = 20 }: GetPayoutsParams = {}): Promise<Cursor<Payout>> {
    if (USE_MOCK) return paginate(MOCK_PAYOUTS, cursor, limit);
    throw new Error('not implemented');
  },

  async flagUser(id: string, body: { flagged: boolean; reason: string }): Promise<{ ok: true }> {
    if (USE_MOCK) {
      // In-memory mutation for local feedback.
      const u = MOCK_USERS.find((x) => x.id === id);
      if (u) u.flagged = body.flagged;
      return { ok: true };
    }
    throw new Error('not implemented');
  },

  async releaseMinor(id: string): Promise<{ ok: true }> {
    if (USE_MOCK) {
      const u = MOCK_USERS.find((x) => x.id === id);
      if (u && u.status === 'MINOR_HOLD') u.status = 'ACTIVE';
      return { ok: true };
    }
    throw new Error('not implemented');
  },
};

export type { User, Payout };
