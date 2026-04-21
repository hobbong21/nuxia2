import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { PriceTag } from './PriceTag';
import { bpsToPercent } from '@/lib/format';

export interface ProductCardData {
  id: string;
  slug: string;
  name: string;
  brandName: string | null;
  imageUrl: string;
  listPriceKrw: string;
  salePriceKrw: string;
  discountPct: number;
  referralPreviewBps: number;
  soldOut: boolean;
  isNew?: boolean;
}

/**
 * designer_spec §5-1 홈 2열 카드 / §6 #2
 * - 이미지 1:1 고정
 * - 타이틀 2줄 말줄임
 * - 우하단 "N% 적립" 뱃지
 */
export function ProductCard({
  product,
  className,
}: {
  product: ProductCardData;
  className?: string;
}) {
  return (
    <Link
      href={`/products/${product.id}`}
      aria-label={`${product.name} 상세 보기`}
      className={cn(
        'group block rounded-card overflow-hidden bg-background transition-shadow duration-base ease-base hover:shadow-card-hover focus-visible:shadow-card-hover',
        className,
      )}
    >
      <div className="relative aspect-square w-full bg-muted overflow-hidden">
        <Image
          src={product.imageUrl}
          alt={product.name}
          fill
          sizes="(min-width: 1024px) 20vw, (min-width: 768px) 25vw, 50vw"
          className="object-cover transition-transform duration-base group-hover:scale-[1.02]"
        />
        {product.isNew && (
          <span className="absolute left-sm top-sm rounded-xs bg-primary px-sm py-xs text-caption font-semibold text-primary-foreground">
            NEW
          </span>
        )}
        {product.soldOut && (
          <div className="absolute inset-0 flex items-center justify-center bg-primary/60 text-primary-foreground text-h4">
            SOLD OUT
          </div>
        )}
        <span className="absolute bottom-sm right-sm rounded-pill bg-referral-earn/90 px-sm py-xs text-caption font-semibold text-white">
          {bpsToPercent(product.referralPreviewBps)} 적립
        </span>
      </div>
      <div className="p-sm space-y-xs">
        {product.brandName && (
          <p className="text-caption text-muted-foreground truncate">
            {product.brandName}
          </p>
        )}
        <h3 className="text-body line-clamp-2 min-h-[44px]">
          {product.name}
        </h3>
        <PriceTag
          listPriceKrw={product.listPriceKrw}
          salePriceKrw={product.salePriceKrw}
          discountPct={product.discountPct}
          size="sm"
          soldOut={product.soldOut}
        />
      </div>
    </Link>
  );
}
