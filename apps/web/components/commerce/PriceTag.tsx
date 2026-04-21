import * as React from 'react';
import { cn } from '@/lib/utils';
import { formatKrw, formatDiscountPct } from '@/lib/format';

export interface PriceTagProps {
  /** 정가 (BigIntString) */
  listPriceKrw: string;
  /** 판매가 (BigIntString) */
  salePriceKrw: string;
  /** 0~100 할인율 */
  discountPct: number;
  size?: 'sm' | 'md' | 'lg';
  soldOut?: boolean;
  className?: string;
}

/**
 * designer_spec §3 "가격 위계 규칙"
 * 1. 할인 후 가격  price-lg 블랙 볼드
 * 2. 원가 취소선  muted
 * 3. 할인율 뱃지  빨강 배경 + 흰 글자
 */
export function PriceTag({
  listPriceKrw,
  salePriceKrw,
  discountPct,
  size = 'md',
  soldOut,
  className,
}: PriceTagProps) {
  const priceSize =
    size === 'lg' ? 'text-price-lg' : size === 'sm' ? 'text-h4' : 'text-h3';

  if (soldOut) {
    return (
      <div className={cn('flex items-center gap-sm', className)}>
        <span className="rounded-pill bg-commerce-soldOut px-sm py-xs text-caption text-white">
          품절
        </span>
        <span className={cn(priceSize, 'text-muted-foreground line-through')}>
          {formatKrw(listPriceKrw)}
        </span>
      </div>
    );
  }

  const hasDiscount = discountPct > 0 && listPriceKrw !== salePriceKrw;

  return (
    <div className={cn('flex flex-col gap-xs', className)}>
      {hasDiscount && (
        <div className="flex items-center gap-sm text-body-sm">
          <span className="rounded-xs bg-commerce-discount px-xs py-[2px] text-caption font-semibold text-white">
            {formatDiscountPct(discountPct)}
          </span>
          <span className="text-commerce-priceOriginal line-through">
            {formatKrw(listPriceKrw)}
          </span>
        </div>
      )}
      <span
        className={cn(priceSize, 'font-bold text-commerce-price')}
        aria-label={formatKrw(salePriceKrw)}
      >
        {formatKrw(salePriceKrw)}
      </span>
    </div>
  );
}
