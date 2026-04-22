'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export type ProductSort = 'newest' | 'popular' | 'priceAsc' | 'priceDesc';

export interface ProductFilterBarProps {
  keyword: string;
  categoryName: string | null;
  sort: ProductSort;
  onKeywordChange: (v: string) => void;
  onCategoryChange: (v: string | null) => void;
  onSortChange: (v: ProductSort) => void;
  className?: string;
}

/** designer_spec §3 카테고리 칩 순서 — 전체 포함 */
export const CATEGORY_CHIPS = [
  { key: null, label: '전체' },
  { key: '의류', label: '의류' },
  { key: '가방', label: '가방' },
  { key: '신발', label: '신발' },
  { key: '액세서리', label: '액세서리' },
  { key: '라이프', label: '라이프' },
] as const;

export const SORT_OPTIONS: { value: ProductSort; label: string }[] = [
  { value: 'newest', label: '최신순' },
  { value: 'popular', label: '인기순' },
  { value: 'priceAsc', label: '낮은가격순' },
  { value: 'priceDesc', label: '높은가격순' },
];

/**
 * 상품 필터바.
 * - 검색 입력 (debounce 300ms — 내부 state & useEffect)
 * - 카테고리 칩 (가로 스크롤, WCAG 터치 44px)
 * - 정렬 select
 *
 * 상위에서는 URL 파라미터와 동기화하여 사용.
 */
export function ProductFilterBar({
  keyword,
  categoryName,
  sort,
  onKeywordChange,
  onCategoryChange,
  onSortChange,
  className,
}: ProductFilterBarProps) {
  const [localKeyword, setLocalKeyword] = React.useState(keyword);

  // 외부 값이 바뀌면 로컬도 sync (뒤로가기로 URL 복귀 시)
  React.useEffect(() => {
    setLocalKeyword(keyword);
  }, [keyword]);

  // debounce 300ms
  React.useEffect(() => {
    if (localKeyword === keyword) return;
    const t = setTimeout(() => onKeywordChange(localKeyword), 300);
    return () => clearTimeout(t);
  }, [localKeyword, keyword, onKeywordChange]);

  return (
    <div
      className={cn(
        'sticky top-header z-raised -mx-base bg-background/95 backdrop-blur border-b border-border',
        className,
      )}
    >
      <div className="px-base pt-sm pb-sm space-y-sm">
        <div className="flex items-center gap-sm">
          <label htmlFor="product-search" className="sr-only">
            상품 검색
          </label>
          <input
            id="product-search"
            type="search"
            inputMode="search"
            value={localKeyword}
            onChange={(e) => setLocalKeyword(e.target.value)}
            placeholder="상품명 검색"
            className={cn(
              'flex-1 h-11 rounded-button border border-border bg-input px-3 text-body',
              'placeholder:text-muted-foreground',
              'focus-visible:border-ring focus-visible:bg-background',
            )}
          />
          <label htmlFor="product-sort" className="sr-only">
            정렬
          </label>
          <select
            id="product-sort"
            value={sort}
            onChange={(e) => onSortChange(e.target.value as ProductSort)}
            className={cn(
              'h-11 min-w-[108px] rounded-button border border-border bg-background px-sm text-body-sm',
              'focus-visible:border-ring',
            )}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div
          role="tablist"
          aria-label="카테고리"
          className="flex gap-xs overflow-x-auto scrollbar-none"
        >
          {CATEGORY_CHIPS.map((c) => {
            const active =
              (c.key === null && categoryName === null) ||
              (c.key !== null && categoryName === c.key);
            return (
              <button
                key={c.label}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onCategoryChange(c.key)}
                className={cn(
                  'tap shrink-0 min-h-11 rounded-pill border px-md text-body-sm',
                  active
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border text-foreground hover:bg-secondary',
                )}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
