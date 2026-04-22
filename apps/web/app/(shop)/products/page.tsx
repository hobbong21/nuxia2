'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Header } from '@/components/commerce/Header';
import { TabBar } from '@/components/commerce/TabBar';
import { ProductCard } from '@/components/commerce/ProductCard';
import {
  ProductFilterBar,
  type ProductSort,
  SORT_OPTIONS,
} from '@/components/commerce/ProductFilterBar';
import { filterMockProducts } from '@/lib/mock';

/**
 * 상품 목록 (v0.3.x — 클라이언트 컴포넌트).
 * URL 쿼리(q / categoryName / sortBy) ↔ 상태 동기화.
 *
 * TODO(v0.4): `api.get('/products', { params: { categoryName, q, sortBy, cursor } })`
 *             로 교체하고 Infinite scroll 분리.
 */
export default function ProductsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const keyword = searchParams.get('q') ?? '';
  const categoryName = searchParams.get('categoryName');
  const sortRaw = searchParams.get('sortBy') as ProductSort | null;
  const sort: ProductSort = SORT_OPTIONS.some((o) => o.value === sortRaw)
    ? (sortRaw as ProductSort)
    : 'popular';

  const updateQuery = React.useCallback(
    (patch: {
      q?: string;
      categoryName?: string | null;
      sortBy?: ProductSort;
    }) => {
      const next = new URLSearchParams(searchParams.toString());
      if ('q' in patch) {
        if (patch.q && patch.q.trim()) next.set('q', patch.q.trim());
        else next.delete('q');
      }
      if ('categoryName' in patch) {
        if (patch.categoryName) next.set('categoryName', patch.categoryName);
        else next.delete('categoryName');
      }
      if ('sortBy' in patch && patch.sortBy) {
        next.set('sortBy', patch.sortBy);
      }
      const qs = next.toString();
      router.replace(qs ? `/products?${qs}` : '/products', { scroll: false });
    },
    [router, searchParams],
  );

  const products = React.useMemo(
    () => filterMockProducts({ categoryName, keyword, sort }),
    [categoryName, keyword, sort],
  );

  return (
    <>
      <Header title="카테고리" showBack />
      <main className="pb-[calc(56px+env(safe-area-inset-bottom)+16px)] px-base pt-base">
        <ProductFilterBar
          keyword={keyword}
          categoryName={categoryName}
          sort={sort}
          onKeywordChange={(v) => updateQuery({ q: v })}
          onCategoryChange={(v) => updateQuery({ categoryName: v })}
          onSortChange={(v) => updateQuery({ sortBy: v })}
        />
        {products.length === 0 ? (
          <p className="py-2xl text-center text-body text-muted-foreground">
            조건에 맞는 상품이 없습니다.
          </p>
        ) : (
          <div className="mt-base grid grid-cols-2 gap-base md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </main>
      <TabBar />
    </>
  );
}
