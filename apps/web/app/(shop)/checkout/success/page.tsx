'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api-client';
import { PaymentConfirmResponseSchema } from '@nuxia2/shared-types';
import { useCartStore } from '@/stores/cart';

/**
 * 결제 완료 콜백 — 백엔드 confirm.
 * 프론트는 paymentId 만 body 로 전달 (orderId 는 URL path 에 포함).
 * 금액 검증/승인은 백엔드가 포트원 API 로 재조회하여 수행.
 * 엔드포인트: POST /payments/orders/:orderId/confirm  body={ paymentId }
 */
export default function CheckoutSuccessPage() {
  const params = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const clearCart = useCartStore((s) => s.clear);

  const paymentId = params.get('paymentId') ?? '';
  const orderId = params.get('orderId') ?? '';

  const [status, setStatus] = React.useState<'pending' | 'success' | 'fail'>('pending');
  const [retryTick, setRetryTick] = React.useState(0);

  React.useEffect(() => {
    if (!paymentId || !orderId) {
      setStatus('fail');
      return;
    }
    // 경로는 REST 규약: /payments/orders/:orderId/confirm
    // body 는 paymentId 만 포함 (orderId 는 path에 이미 존재)
    api
      .post(
        `/payments/orders/${encodeURIComponent(orderId)}/confirm`,
        { paymentId },
        PaymentConfirmResponseSchema,
      )
      .then((res) => {
        if (res.status === 'PAID') {
          setStatus('success');
          clearCart();
        } else {
          // PAID 가 아닌 모든 상태(FAILED/CANCELLED/PENDING 등)는 사용자 관점에서 실패로 처리.
          setStatus('fail');
          toast.show(res.message ?? `결제 확인 실패 (${res.status})`, 'error');
        }
      })
      .catch((err) => {
        // 백엔드 호출 실패(네트워크/서버 오류) 는 절대 "성공" 으로 처리하지 않는다.
        setStatus('fail');
        toast.show(
          '결제 확인 중 오류가 발생했습니다. 고객센터(1588-0000)로 문의해 주세요.',
          'error',
        );
      });
  }, [paymentId, orderId, clearCart, toast, retryTick]);

  return (
    <main className="flex min-h-[80vh] flex-col items-center justify-center gap-base px-base text-center">
      {status === 'pending' && (
        <>
          <div className="h-12 w-12 animate-spin rounded-pill border-4 border-accent border-t-transparent" />
          <p className="text-body text-muted-foreground">결제를 확인하고 있습니다...</p>
        </>
      )}
      {status === 'success' && (
        <>
          <div
            aria-hidden
            className="flex h-16 w-16 items-center justify-center rounded-pill bg-status-success text-primary-foreground text-h2"
          >
            ✓
          </div>
          <h1 className="text-h2">결제가 완료되었습니다</h1>
          <p className="text-body text-muted-foreground">
            주문 상세는 마이페이지에서 확인하실 수 있습니다.
          </p>
          <div className="flex gap-sm">
            <Button asChild variant="secondary" size="lg">
              <Link href="/">홈</Link>
            </Button>
            <Button asChild variant="accent" size="lg">
              <Link href="/mypage/orders">주문 내역</Link>
            </Button>
          </div>
        </>
      )}
      {status === 'fail' && (
        <>
          <h1 className="text-h2">결제 확인에 실패했습니다</h1>
          <p className="text-body text-muted-foreground">
            결제는 진행되었을 수 있으나 서버에서 확정 처리를 완료하지 못했습니다.
            <br />
            중복 결제를 방지하기 위해 다시 결제를 시도하기 전 고객센터에 먼저 문의해 주세요.
          </p>
          <p className="text-body-sm text-muted-foreground">
            고객센터 1588-0000 (평일 09:00 ~ 18:00)
          </p>
          <div className="flex gap-sm">
            <Button
              variant="secondary"
              size="lg"
              onClick={() => {
                setStatus('pending');
                setRetryTick((n) => n + 1);
              }}
            >
              다시 시도
            </Button>
            <Button variant="accent" size="lg" onClick={() => router.push('/mypage/orders')}>
              주문 내역 확인
            </Button>
          </div>
        </>
      )}
    </main>
  );
}
