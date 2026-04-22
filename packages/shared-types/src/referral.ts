import { z } from 'zod';
import { BigIntStringSchema, IdSchema, IsoDateTimeSchema } from './common';

/** 세대별 지급률 (bps): 1대 300 / 2대 500 / 3대 1700 */
export const GenerationSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);
export type Generation = z.infer<typeof GenerationSchema>;

export const LedgerTypeSchema = z.enum(['EARN', 'REVERT']);
export type LedgerType = z.infer<typeof LedgerTypeSchema>;

export const LedgerStatusSchema = z.enum([
  'PENDING',
  'CONFIRMED',
  'SUSPENDED_FOR_REVIEW',
  'PAID',
  'CLAWBACK_REQUESTED',
]);
export type LedgerStatus = z.infer<typeof LedgerStatusSchema>;

export const ReferralLedgerSchema = z.object({
  id: IdSchema,
  orderId: IdSchema,
  beneficiaryUserId: IdSchema,
  generation: GenerationSchema,
  rateBps: z.union([z.literal(300), z.literal(500), z.literal(1700)]),
  /** EARN은 양수, REVERT는 음수 */
  amountKrw: BigIntStringSchema,
  type: LedgerTypeSchema,
  status: LedgerStatusSchema,
  reason: z.string().nullable(),
  createdAt: IsoDateTimeSchema,
});
export type ReferralLedger = z.infer<typeof ReferralLedgerSchema>;

/** 트리 노드 (재귀. 최대 3 depth) */
export const TreeNodeSchema: z.ZodType<TreeNode> = z.lazy(() =>
  z.object({
    userId: IdSchema,
    nickname: z.string(),
    referralCode: z.string(),
    generation: z.union([
      z.literal(0), // 루트(본인)
      z.literal(1),
      z.literal(2),
      z.literal(3),
    ]),
    /** 셀프레퍼럴·어뷰징 등으로 체인에서 차단된 노드 표시용 */
    blockedReason: z.enum(['SELF_REFERRAL', 'STAFF', 'SUSPENDED', 'WITHDRAWN']).nullable(),
    joinedAt: IsoDateTimeSchema,
    /** 이번 달 이 노드로부터 발생한 기여(매출, 기준액) */
    contributionThisMonthKrw: BigIntStringSchema,
    /** 이번 달 내가 받을 예정 수익 (이 노드 기여 × 내 세대 비율) */
    myEarningThisMonthKrw: BigIntStringSchema,
    children: z.array(TreeNodeSchema),
  }),
);
export type TreeNode = {
  userId: string;
  nickname: string;
  referralCode: string;
  generation: 0 | 1 | 2 | 3;
  blockedReason: 'SELF_REFERRAL' | 'STAFF' | 'SUSPENDED' | 'WITHDRAWN' | null;
  joinedAt: string;
  contributionThisMonthKrw: string;
  myEarningThisMonthKrw: string;
  children: TreeNode[];
};

/** GET /referral/dashboard 응답 */
export const DashboardResponseSchema = z.object({
  /** 이번 달 예상 수익 (총) */
  expectedThisMonthKrw: BigIntStringSchema,
  /** 세대별 breakdown */
  byGeneration: z.object({
    gen1: z.object({
      rateBps: z.literal(300),
      amountKrw: BigIntStringSchema,
      orderCount: z.number().int().nonnegative(),
    }),
    gen2: z.object({
      rateBps: z.literal(500),
      amountKrw: BigIntStringSchema,
      orderCount: z.number().int().nonnegative(),
    }),
    gen3: z.object({
      rateBps: z.literal(1700),
      amountKrw: BigIntStringSchema,
      orderCount: z.number().int().nonnegative(),
    }),
  }),
  /** 상태 요약 */
  summary: z.object({
    payableKrw: BigIntStringSchema,
    withheldKrw: BigIntStringSchema,
    revertedKrw: BigIntStringSchema,
    withheldCount: z.number().int().nonnegative(),
    revertedCount: z.number().int().nonnegative(),
  }),
  /** 최근 원장 (최대 10건) */
  recent: z.array(ReferralLedgerSchema),
  /** 트리 루트 (본인) */
  tree: TreeNodeSchema,
});
export type DashboardResponse = z.infer<typeof DashboardResponseSchema>;

/** Payout (월 정산) */
export const PayoutStatusSchema = z.enum([
  'PENDING',
  'WITHHELD',
  'PAID',
  'FAILED',
  'CLAWBACK_REQUESTED',
]);
export type PayoutStatus = z.infer<typeof PayoutStatusSchema>;

export const PayoutSchema = z.object({
  id: IdSchema,
  userId: IdSchema,
  periodStart: IsoDateTimeSchema,
  periodEnd: IsoDateTimeSchema,
  amountGrossKrw: BigIntStringSchema,
  /** 정책 01a T1 — 원천징수 3.3% */
  amountTaxKrw: BigIntStringSchema,
  amountNetKrw: BigIntStringSchema,
  status: PayoutStatusSchema,
  bankMaskedAccount: z.string().nullable(),
  paidAt: IsoDateTimeSchema.nullable(),
});
export type Payout = z.infer<typeof PayoutSchema>;
