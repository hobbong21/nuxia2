import { z } from 'zod';
import { BigIntStringSchema } from './common';

/**
 * 포트원 V2 결제 완료 후 프론트가 백엔드에 전달하는 confirm 요청.
 * - 프론트는 paymentId/orderId만 전달. 금액 재검증은 백엔드가 포트원 API로 단건 조회 후 수행.
 */
export const PaymentConfirmRequestSchema = z.object({
  orderId: z.string().uuid(),
  paymentId: z.string().min(1),
  /** 포트론 txId (선택) */
  txId: z.string().optional(),
});
export type PaymentConfirmRequest = z.infer<typeof PaymentConfirmRequestSchema>;

export const PaymentConfirmResponseSchema = z.object({
  orderId: z.string().uuid(),
  status: z.enum(['PAID', 'PENDING_PAYMENT', 'CANCELLED', 'FAILED']),
  amountPaidKrw: BigIntStringSchema,
  message: z.string().optional(),
});
export type PaymentConfirmResponse = z.infer<typeof PaymentConfirmResponseSchema>;

/** 본인인증 결과 confirm (백엔드가 포트원 API로 ci 획득) */
export const IdentityVerifyRequestSchema = z.object({
  identityVerificationId: z.string().min(1),
});
export type IdentityVerifyRequest = z.infer<typeof IdentityVerifyRequestSchema>;

export const IdentityVerifyResponseSchema = z.object({
  verified: z.boolean(),
  /** 만 나이. 수익 수취 적격성 판정용 */
  age: z.number().int().min(0).max(150).nullable(),
  gender: z.enum(['M', 'F']).nullable(),
  /** ci는 절대 프론트에 내려보내지 않음. 존재 여부만 boolean */
  message: z.string().optional(),
});
export type IdentityVerifyResponse = z.infer<typeof IdentityVerifyResponseSchema>;
