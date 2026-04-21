import { Header } from '@/components/commerce/Header';
import { TabBar } from '@/components/commerce/TabBar';
import { ProductCard } from '@/components/commerce/ProductCard';
import { MOCK_PRODUCTS } from '@/lib/mock';

/**
 * 상품 목록 — Server Component.
 * TODO: /products?page=&categoryId=&sort= 호출, Infinite scroll은 Client 분리.
 */
export default async function ProductsPage() {
  const products = MOCK_PRODUCTS;
  return (
    <>
      <Header title="카테고리" showBack />
      <main className="pb-[calc(56px+env(safe-area-inset-bottom)+16px)] px-base pt-base">
        <div className="sticky top-header z-raised -mx-base mb-sm flex items-center gap-sm border-b border-border bg-background/95 px-base py-sm backdrop-blur">
          <button className="tap rounded-pill border border-border px-md text-body-sm">
            인기순 ▼
          </button>
          <button className="tap rounded-pill border border-border px-md text-body-sm">
            필터 ▼
          </button>
        </div>
        <div className="grid grid-cols-2 gap-base md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </main>
      <TabBar />
    </>
  );
}
