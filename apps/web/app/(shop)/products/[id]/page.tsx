import Image from 'next/image';
import { notFound } from 'next/navigation';
import { Header } from '@/components/commerce/Header';
import { PriceTag } from '@/components/commerce/PriceTag';
import { Button } from '@/components/ui/button';
import { MOCK_PRODUCTS } from '@/lib/mock';
import { AddToCartButtons } from './add-to-cart';

/**
 * 상품 상세 — Server Component (이미지/가격은 SSR).
 * 장바구니·구매 인터랙션은 AddToCartButtons (client).
 */
export default async function ProductDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const product = MOCK_PRODUCTS.find((p) => p.id === params.id);
  if (!product) notFound();
  return (
    <>
      <Header title="상품" showBack />
      <main className="pb-[120px]">
        <div className="relative aspect-square w-full bg-muted">
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            sizes="(min-width: 768px) 50vw, 100vw"
            className="object-cover"
            priority
          />
        </div>
        <div className="px-base pt-base space-y-sm">
          {product.brandName && (
            <p className="text-caption text-muted-foreground">{product.brandName}</p>
          )}
          <h1 className="text-h3 line-clamp-2">{product.name}</h1>
          <div className="border-t border-border pt-base">
            <PriceTag
              listPriceKrw={product.listPriceKrw}
              salePriceKrw={product.salePriceKrw}
              discountPct={product.discountPct}
              size="lg"
            />
            <p className="mt-xs text-body-sm text-referral-earn font-semibold">
              3% 적립 · 무료배송
            </p>
          </div>
          <section className="border-t border-border pt-base space-y-sm">
            <h2 className="text-lead">상세 정보</h2>
            <p className="text-body text-muted-foreground whitespace-pre-wrap leading-relaxed">
              프리미엄 원단으로 제작된 오버핏 셔츠입니다. 한국에서 디자인하고
              제조되어 품질과 핏 모두 만족스러운 착용감을 제공합니다.
            </p>
          </section>
          <section className="border-t border-border pt-base space-y-sm">
            <h2 className="text-lead">배송 · 반품</h2>
            <ul className="text-body-sm text-muted-foreground leading-relaxed list-disc pl-md">
              <li>주문 후 1–3 영업일 이내 출고</li>
              <li>구매확정 후 7일 이내 청약철회 가능</li>
              <li>구매확정 후 7일 경과 시 역정산은 생략 (정책 T2)</li>
            </ul>
          </section>
        </div>
        <AddToCartButtons product={product} />
      </main>
    </>
  );
}
