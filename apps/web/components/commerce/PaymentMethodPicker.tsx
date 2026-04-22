'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * 결제수단 키.
 * - card: 신용/체크카드 (포트원 V2 일반 결제 채널)
 * - transfer: 계좌이체 / 가상계좌 (포트원 V2 이체 채널)
 * - easypay: 간편결제 (토스페이·카카오페이·네이버페이 — 단일 easypay 채널)
 *
 * NOTE: 각 method 는 `NEXT_PUBLIC_PORTONE_*_CHANNEL_KEY` 로 매핑되며,
 *       실제 channelKey 주입은 체크아웃 페이지의 `CHANNEL_KEY_MAP` 에서 담당.
 *       (여기서는 선택 UI만 담당하여 포트원 의존성 0)
 */
export type PaymentMethod = 'card' | 'transfer' | 'easypay';

export interface PaymentMethodPickerProps {
  value: PaymentMethod;
  onChange: (method: PaymentMethod) => void;
  className?: string;
}

interface MethodDef {
  key: PaymentMethod;
  label: string;
  description: string;
}

const METHODS: MethodDef[] = [
  {
    key: 'card',
    label: '카드',
    description: '신용/체크카드 결제 (할부 지원)',
  },
  {
    key: 'transfer',
    label: '계좌이체',
    description: '실시간 계좌이체 / 가상계좌 발급',
  },
  {
    key: 'easypay',
    label: '간편결제',
    description: '토스페이 · 네이버페이 · 카카오페이',
  },
];

export function PaymentMethodPicker({
  value,
  onChange,
  className,
}: PaymentMethodPickerProps) {
  const current = METHODS.find((m) => m.key === value) ?? METHODS[0];

  return (
    <div className={cn('space-y-sm', className)}>
      <div
        role="tablist"
        aria-label="결제수단 선택"
        className="grid grid-cols-3 rounded-card border border-border bg-muted p-xs gap-xs"
      >
        {METHODS.map((m) => {
          const active = m.key === value;
          return (
            <button
              key={m.key}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={`pm-panel-${m.key}`}
              id={`pm-tab-${m.key}`}
              onClick={() => onChange(m.key)}
              className={cn(
                'tap min-h-11 rounded-button px-sm text-body-sm font-semibold transition-colors duration-snap',
                active
                  ? 'bg-background text-foreground shadow-card'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {m.label}
            </button>
          );
        })}
      </div>
      <div
        role="tabpanel"
        id={`pm-panel-${current.key}`}
        aria-labelledby={`pm-tab-${current.key}`}
        className="rounded-card border border-border bg-background p-base"
      >
        <p className="text-body font-semibold">{current.label}</p>
        <p className="mt-xs text-body-sm text-muted-foreground">
          {current.description}
        </p>
      </div>
    </div>
  );
}
