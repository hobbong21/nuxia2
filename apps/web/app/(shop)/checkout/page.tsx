'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/commerce/Header';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { TopSheet } from '@/components/referral/TopSheet';
import { ShippingAddressForm } from '@/components/commerce/ShippingAddressForm';
import {
  PaymentMethodPicker,
  type PaymentMethod,
} from '@/components/commerce/PaymentMethodPicker';
import { useCartStore, cartSubtotal } from '@/stores/cart';
import { useShippingStore } from '@/stores/shipping';
import { formatKrw } from '@/lib/format';
import { requestPayment } from '@/lib/portone';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api-client';
import {
  CreateOrderResponseSchema,
  type ShippingAddress,
} from '@nuxia2/shared-types';

/**
 * 체크아웃 — 포트원 결제 TopSheet 호출.
 * 흐름:
 *   1) POST /orders ({ items, shippingAddress }) → 서버가 { orderId, paymentId, totalAmountKrw } 반환
 *   2) 선택된 결제수단의 channelKey 로 PortOne.requestPayment 호출
 *   3) 결제 성공 시 /checkout/success?paymentId=...&orderId=... 로 이동하여 confirm 호출
 */

/** 결제수단 → 포트원 channelKey 매핑 (환경변수 우선) */
const CHANNEL_KEY_MAP: Record<PaymentMethod, string> = {
  card:
    process.env.NEXT_PUBLIC_PORTONE_CARD_CHANNEL_KEY ?? 'channel-key-card',
  transfer:
    process.env.NEXT_PUBLIC_PORTONE_TRANSFER_CHANNEL_KEY ??
    'channel-key-transfer',
  easypay:
    process.env.NEXT_PUBLIC_PORTONE_EASYPAY_CHANNEL_KEY ??
    'channel-key-easypay',
};

export default function CheckoutPage() {
  const router = useRouter();
  const { lines } = useCartStore();
  const { savedAddress, setAddress } = useShippingStore();

  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [agreed, setAgreed] = React.useState(false);
  const toast = useToast();

  // 저장된 배송지가 있으면 "요약+수정", 없으면 폼 바로 노출
  const [editingAddress, setEditingAddress] = React.useState(!savedAddress);
  const [draftAddress, setDraftAddress] = React.useState<ShippingAddress | null>(
    savedAddress ?? null,
  );
  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod>('card');

  const subtotal = cartSubtotal(lines);

  const effectiveAddress = editingAddress ? draftAddress : savedAddress;

  const canPay = Boolean(agreed && effectiveAddress && lines.length > 0);

  const onPay = async () => {
    if (!effectiveAddress) {
      toast.show('배송지를 입력해 주세요', 'warning');
      return;
    }
    if (!agreed) {
      toast.show('구매 조건에 동의해 주세요', 'warning');
      return;
    }
    // 편집 중이었다면 저장
    if (editingAddress) {
      setAddress(effectiveAddress);
    }

    setLoading(true);
    setSheetOpen(true);
    try {
      const createOrderPayload = {
        items: lines.map((l) => ({
          productId: l.productId,
          quantity: l.quantity,
        })),
        shippingAddress: effectiveAddress,
      };
      let orderId: string;
      let paymentId: string;
      try {
        const order = await api.post(
          '/orders',
          createOrderPayload,
          CreateOrderResponseSchema,
        );
        orderId = order.orderId;
        paymentId = order.paymentId;
      } catch (e) {
        toast.show('주문 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.', 'error');
        return;
      }

      const result = await requestPayment({
        orderName: lines[0]?.name ?? '주문상품',
        totalAmountKrw: subtotal,
        paymentId,
        customerId: 'TEMP_USER_ID',
        channelKey: CHANNEL_KEY_MAP[paymentMethod],
      });
      if (result.code) {
        toast.show(`결제 실패: ${result.message ?? result.code}`, 'error');
        return;
      }

      router.push(
        `/checkout/success?paymentId=${encodeURIComponent(paymentId)}&orderId=${encodeURIComponent(orderId)}`,
      );
    } catch (err) {
      toast.show('결제 중 오류가 발생했습니다', 'error');
    } finally {
      setLoading(false);
      setSheetOpen(false);
    }
  };

  return (
    <>
      <Header title="주문/결제" showBack />
      <main className="pb-[140px] px-base pt-base space-y-base">
        <section className="rounded-card border border-border p-base space-y-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lead">배송지</h2>
            {savedAddress && !editingAddress && (
              <button
                type="button"
                onClick={() => {
                  setDraftAddress(savedAddress);
                  setEditingAddress(true);
                }}
                className="tap text-body-sm text-accent hover:text-accent-hover"
              >
                수정
              </button>
            )}
          </div>

          {savedAddress && !editingAddress ? (
            <AddressSummary address={savedAddress} />
          ) : (
            <ShippingAddressForm
              initialValue={draftAddress}
              showSubmit={false}
              onValidChange={setDraftAddress}
            />
          )}

          {editingAddress && savedAddress && (
            <button
              type="button"
              onClick={() => setEditingAddress(false)}
              className="tap text-body-sm text-muted-foreground"
            >
              취소 (저장된 배송지 사용)
            </button>
          )}
        </section>

        <section className="rounded-card border border-border p-base">
          <h2 className="text-lead mb-sm">주문 상품 ({lines.length})</h2>
          <ul className="space-y-xs text-body-sm">
            {lines.map((l) => (
              <li key={l.productId} className="flex justify-between">
                <span className="truncate">
                  {l.name} × {l.quantity}
                </span>
                <span className="tabular-nums">
                  {formatKrw(
                    (BigInt(l.unitPriceKrw) * BigInt(l.quantity)).toString(),
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-card border border-border p-base space-y-sm">
          <h2 className="text-lead">할인/포인트</h2>
          <Input placeholder="쿠폰 선택" readOnly />
          <Input placeholder="0" type="number" aria-label="사용 포인트" />
          <p className="text-caption text-muted-foreground">보유 포인트 1,200P</p>
        </section>

        <section className="rounded-card border border-border p-base space-y-sm">
          <h2 className="text-lead">결제수단</h2>
          <PaymentMethodPicker
            value={paymentMethod}
            onChange={setPaymentMethod}
          />
        </section>

        <section className="rounded-card border border-border p-base space-y-sm">
          <label className="flex items-center gap-sm tap">
            <input
              type="checkbox"
              className="h-5 w-5 accent-accent"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
            />
            <span className="text-body-sm">
              개인정보 제3자 제공 및 구매 조건 확인에 동의합니다
            </span>
          </label>
        </section>

        <section className="rounded-card border border-border p-base flex justify-between text-lead">
          <span>결제 예정</span>
          <span className="font-bold">{formatKrw(subtotal)}</span>
        </section>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-tabbar border-t border-border bg-background/95 backdrop-blur pb-safe">
        <div className="mx-auto max-w-[1200px] p-base">
          <Button
            variant="accent"
            size="xl"
            block
            loading={loading}
            disabled={!canPay}
            onClick={onPay}
          >
            {formatKrw(subtotal)} 결제하기
          </Button>
        </div>
      </div>

      <TopSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="결제 진행 중"
      >
        <div className="flex items-center justify-center py-2xl text-body text-muted-foreground">
          포트원 결제 창이 열립니다...
        </div>
      </TopSheet>
    </>
  );
}

function AddressSummary({ address }: { address: ShippingAddress }) {
  return (
    <div className="space-y-xs">
      <p className="text-body">
        <span className="font-semibold">{address.recipientName}</span>{' '}
        <span className="text-muted-foreground">{address.phone}</span>
      </p>
      <p className="text-body-sm text-muted-foreground">
        [{address.zipCode}] {address.address1}
        {address.address2 ? ` ${address.address2}` : ''}
      </p>
      {address.memo && (
        <p className="text-caption text-muted-foreground">메모: {address.memo}</p>
      )}
    </div>
  );
}
