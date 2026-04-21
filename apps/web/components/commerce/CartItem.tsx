'use client';

import * as React from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { formatKrw } from '@/lib/format';
import { Button } from '@/components/ui/button';
import type { CartLine } from '@/stores/cart';

export interface CartItemProps {
  line: CartLine;
  onToggle: (id: string) => void;
  onQuantity: (id: string, qty: number) => void;
  onRemove: (id: string) => void;
  className?: string;
}

export function CartItem({
  line,
  onToggle,
  onQuantity,
  onRemove,
  className,
}: CartItemProps) {
  const total = (BigInt(line.unitPriceKrw) * BigInt(line.quantity)).toString();
  return (
    <article
      className={cn(
        'flex gap-md p-base rounded-card border border-border bg-background',
        'min-h-[88px]',
        className,
      )}
    >
      <label className="flex items-start pt-xs tap" aria-label="선택">
        <input
          type="checkbox"
          checked={line.selected}
          onChange={() => onToggle(line.productId)}
          className="h-5 w-5 rounded-xs border-border-strong accent-accent"
        />
      </label>
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-sm bg-muted">
        <Image
          src={line.imageUrl}
          alt={line.name}
          fill
          sizes="80px"
          className="object-cover"
        />
      </div>
      <div className="flex-1 min-w-0 flex flex-col gap-xs">
        <h4 className="text-body line-clamp-1">{line.name}</h4>
        {line.optionSummary && (
          <p className="text-caption text-muted-foreground">옵션: {line.optionSummary}</p>
        )}
        <p className="text-body font-semibold">{formatKrw(total)}</p>
        <div className="mt-xs flex items-center gap-sm">
          <div className="inline-flex items-center rounded-button border border-border">
            <button
              type="button"
              aria-label="수량 감소"
              className="tap flex items-center justify-center"
              onClick={() => onQuantity(line.productId, line.quantity - 1)}
              disabled={line.quantity <= 1}
            >
              −
            </button>
            <span
              className="px-md text-body-sm tabular-nums"
              aria-live="polite"
            >
              {line.quantity}
            </span>
            <button
              type="button"
              aria-label="수량 증가"
              className="tap flex items-center justify-center"
              onClick={() => onQuantity(line.productId, line.quantity + 1)}
            >
              +
            </button>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="삭제"
            onClick={() => onRemove(line.productId)}
          >
            ×
          </Button>
        </div>
      </div>
    </article>
  );
}
