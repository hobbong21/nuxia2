'use client';

/**
 * 포트원 V2 결제/본인인증 프론트 연동 단일 진입점.
 * - UI 컴포넌트는 이 파일의 함수만 호출할 것.
 * - 금액 검증/ci 획득은 반드시 백엔드에서 수행 (프론트는 식별자만 중계).
 */

import type { BigIntString } from '@nuxia2/shared-types';

export interface RequestPaymentParams {
  orderName: string;
  /** 금액은 number로 변환하여 전달 (포트원 SDK 규격). BigIntString 허용. */
  totalAmountKrw: BigIntString | number;
  paymentId: string;
  customerId: string;
  /** 선택된 결제 채널 (카드 / 간편결제 / 가상계좌 등). 환경변수 기본값 사용 */
  channelKey?: string;
}

export interface RequestPaymentResult {
  paymentId: string;
  /** 포트원 결과코드. 실패면 code 존재 */
  code?: string;
  message?: string;
  txId?: string;
}

export async function requestPayment(
  params: RequestPaymentParams,
): Promise<RequestPaymentResult> {
  const PortOne = (await import('@portone/browser-sdk/v2')).default;
  const storeId = process.env.NEXT_PUBLIC_PORTONE_STORE_ID!;
  const channelKey =
    params.channelKey ?? process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY!;

  const amount =
    typeof params.totalAmountKrw === 'string'
      ? Number(params.totalAmountKrw)
      : params.totalAmountKrw;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const response = await PortOne.requestPayment({
    storeId,
    channelKey,
    paymentId: params.paymentId,
    orderName: params.orderName,
    totalAmount: amount,
    currency: 'KRW',
    customer: { customerId: params.customerId },
  } as any);

  // SDK response 구조: { code?, message?, paymentId, ... }
  return {
    paymentId: params.paymentId,
    code: (response as { code?: string } | null | undefined)?.code,
    message: (response as { message?: string } | null | undefined)?.message,
    txId: (response as { txId?: string } | null | undefined)?.txId,
  };
}

export interface IdentityVerifyResult {
  identityVerificationId: string;
  code?: string;
  message?: string;
}

export async function requestIdentityVerification(params: {
  userId: string;
  identityVerificationId?: string;
}): Promise<IdentityVerifyResult> {
  const PortOne = (await import('@portone/browser-sdk/v2')).default;
  const storeId = process.env.NEXT_PUBLIC_PORTONE_STORE_ID!;
  const channelKey = process.env.NEXT_PUBLIC_PORTONE_IV_CHANNEL_KEY!;
  const identityVerificationId =
    params.identityVerificationId ?? `iv_${crypto.randomUUID()}`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const response = await PortOne.requestIdentityVerification({
    storeId,
    channelKey,
    identityVerificationId,
    customer: { customerId: params.userId },
  } as any);

  return {
    identityVerificationId,
    code: (response as { code?: string } | null | undefined)?.code,
    message: (response as { message?: string } | null | undefined)?.message,
  };
}
