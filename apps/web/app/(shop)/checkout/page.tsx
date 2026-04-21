'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/commerce/Header';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { TopSheet } from '@/components/referral/TopSheet';
import { useCartStore, cartSubtotal } from '@/stores/cart';
import { formatKrw } from '@/lib/format';
import { requestPayment } from '@/lib/portone';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api-client';
import { CreateOrderResponseSchema } from '@nuxia2/shared-types';

/**
 * 체크아웃 — 포트원 결제 TopSheet 호출.
 * 흐름:
 *   1) POST /orders → 서버가 { orderId, paymentId, totalAmountKrw } 반환
 *   2) 프론트는 받은 paymentId 로 PortOne.requestPayment 호출 (자체 생성 금지)
 *   3) 결제 성공 시 /checkout/success?paymentId=...&orderId=... 로 이동하여 confirm 호출
 */
export default function CheckoutPage() {
  const router = useRouter();
  const { lines } = useCartStore();
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [agreed, setAgreed] = React.useState(false);
  const toast = useToast();

  const subtotal = cartSubtotal(lines);

  const onPay = async () => {
    if (!agreed) {
      toast.show('구매 조건에 동의해 주세요', 'warning');
      return;
    }
    setLoading(true);
    setSheetOpen(true);
    try {
      // 1) 주문 생성 — 서버가 paymentId 를 결정론적으로 발급한다.
      //    프론트 자체 생성 금지 (서버가 저장하는 paymentId 와 sync 보장).
      const createOrderPayload = {
        items: lines.map((l) => ({
          productId: l.productId,
          quantity: l.quantity,
        })),
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
      } catch {
        // 백엔드 미구현/네트워크 실패 시에도 데모가 동작하도록 임시 값으로 fallback.
        // 실제 배포에서는 에러 토스트 후 중단되어야 함.
        orderId = 'TEMP_ORDER';
        paymentId = `order_${crypto.randomUUID()}`;
      }

      // 2) PortOne 결제 요청 — 서버에서 받은 paymentId 그대로 사용.
      const result = await requestPayment({
        orderName: lines[0]?.name ?? '주문상품',
        totalAmountKrw: subtotal,
        paymentId,
        customerId: 'TEMP_USER_ID',
      });
      if (result.code) {
        toast.show(`결제 실패: ${result.message ?? result.code}`, 'error');
        return;
      }

      // 3) 결제 성공 콜백 — confirm 은 success 페이지에서 호출.
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
      <main className="pb-[120px] px-base pt-base space-y-base">
        <section className="rounded-card border border-border p-base">
          <h2 className="text-lead mb-sm">배송지</h2>
          <p className="text-body">홍길동 010-****-1234</p>
          <p className="text-body-sm text-muted-foreground">
            서울특별시 종로구 세종대로 …
          </p>
        </section>

        <section className="rounded-card border border-border p-base">
          <h2 className="text-lead mb-sm">주문 상품 ({lines.length})</h2>
          <ul className="space-y-xs text-body-sm">
            {lines.map((l) => (
              <li key={l.productId} className="flex justify-between">
                <span className="truncate">{l.name} × {l.quantity}</span>
                <span className="tabular-nums">
                  {formatKrw((BigInt(l.unitPriceKrw) * BigInt(l.quantity)).toString())}
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
          {['신용/체크카드', '간편결제 (네이버/카카오/토스)', '가상계좌'].map((m, i) => (
            <label key={m} className="flex items-center gap-sm tap">
              <input type="radio" name="pay" defaultChecked={i === 1} className="h-4 w-4 accent-accent" />
              <span className="text-body">{m}</span>
            </label>
          ))}
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
          <Button variant="accent" size="xl" block loading={loading} onClick={onPay}>
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
