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

/**
 * 체크아웃 — 포트원 결제 TopSheet 호출.
 * TODO: POST /orders 로 주문 생성 후 paymentId를 포트원에 전달.
 *       현재는 임시 paymentId를 생성하고 성공 후 /checkout/success로 이동하면서 ?paymentId=... 를 넘긴다.
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
      const paymentId = `order_${crypto.randomUUID()}`;
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
      router.push(`/checkout/success?paymentId=${paymentId}&orderId=TEMP_ORDER`);
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
