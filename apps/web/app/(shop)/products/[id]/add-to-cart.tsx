'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useCartStore } from '@/stores/cart';
import { useToast } from '@/components/ui/toast';
import type { ProductCardData } from '@/components/commerce/ProductCard';

export function AddToCartButtons({ product }: { product: ProductCardData }) {
  const router = useRouter();
  const addLine = useCartStore((s) => s.addLine);
  const toast = useToast();

  const onAdd = () => {
    addLine({
      productId: product.id,
      name: product.name,
      imageUrl: product.imageUrl,
      unitPriceKrw: product.salePriceKrw,
      quantity: 1,
    });
    toast.show('장바구니에 담았습니다', 'success');
  };

  const onBuy = () => {
    addLine({
      productId: product.id,
      name: product.name,
      imageUrl: product.imageUrl,
      unitPriceKrw: product.salePriceKrw,
      quantity: 1,
    });
    router.push('/checkout');
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-tabbar border-t border-border bg-background/95 backdrop-blur pb-safe">
      <div className="mx-auto flex max-w-[1200px] items-center gap-sm p-base">
        <Button
          variant="ghost"
          size="icon"
          aria-label="찜"
          disabled={product.soldOut}
        >
          ♡
        </Button>
        <Button
          variant="primary"
          size="lg"
          block
          onClick={onAdd}
          disabled={product.soldOut}
        >
          장바구니
        </Button>
        <Button
          variant="accent"
          size="lg"
          block
          onClick={onBuy}
          disabled={product.soldOut}
        >
          바로구매
        </Button>
      </div>
    </div>
  );
}
