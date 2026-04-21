'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/commerce/Header';
import { CartItem } from '@/components/commerce/CartItem';
import { Button } from '@/components/ui/button';
import { cartSubtotal, useCartStore } from '@/stores/cart';
import { formatKrw } from '@/lib/format';

export default function CartPage() {
  const router = useRouter();
  const { lines, toggleSelected, toggleSelectAll, setQuantity, removeLine, removeSelected } =
    useCartStore();
  const subtotal = cartSubtotal(lines);
  const allSelected = lines.length > 0 && lines.every((l) => l.selected);

  return (
    <>
      <Header title={`장바구니 (${lines.length})`} showBack />
      <main className="pb-[calc(88px+env(safe-area-inset-bottom))]">
        {lines.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-base px-base pt-section text-center">
            <p className="text-body text-muted-foreground">장바구니가 비어있습니다</p>
            <Button asChild variant="accent" size="lg">
              <Link href="/products">쇼핑하러 가기</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-border px-base py-sm">
              <label className="inline-flex items-center gap-sm tap">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(e) => toggleSelectAll(e.target.checked)}
                  className="h-5 w-5 accent-accent"
                />
                <span className="text-body-sm">
                  전체선택 ({lines.filter((l) => l.selected).length}/{lines.length})
                </span>
              </label>
              <button
                type="button"
                className="tap text-body-sm text-muted-foreground"
                onClick={removeSelected}
              >
                선택삭제
              </button>
            </div>
            <ul className="px-base pt-base space-y-sm">
              {lines.map((line) => (
                <li key={line.productId}>
                  <CartItem
                    line={line}
                    onToggle={toggleSelected}
                    onQuantity={setQuantity}
                    onRemove={removeLine}
                  />
                </li>
              ))}
            </ul>

            <section className="mt-base border-t border-border px-base pt-base space-y-xs text-body-sm">
              <Row label="상품 금액" value={formatKrw(subtotal)} />
              <Row label="배송비" value="무료" />
              <Row label="쿠폰 할인" value="-0원" />
              <div className="border-t border-border pt-sm flex items-baseline justify-between">
                <span className="text-lead font-semibold">결제 예정</span>
                <span className="text-price-lg font-bold">{formatKrw(subtotal)}</span>
              </div>
              <p className="text-caption text-referral-earn">
                ▸ 3% 레퍼럴 예상 {formatKrw((BigInt(subtotal) * 3n / 100n).toString())}
              </p>
            </section>
          </>
        )}

        {lines.length > 0 && (
          <div className="fixed inset-x-0 bottom-0 z-tabbar border-t border-border bg-background/95 backdrop-blur pb-safe">
            <div className="mx-auto max-w-[1200px] p-base">
              <Button
                variant="accent"
                size="xl"
                block
                onClick={() => router.push('/checkout')}
              >
                {formatKrw(subtotal)} 결제하기
              </Button>
            </div>
          </div>
        )}
      </main>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
