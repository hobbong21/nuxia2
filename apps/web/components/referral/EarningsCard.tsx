import * as React from 'react';
import { cn } from '@/lib/utils';
import { formatKrw } from '@/lib/format';
import type { DashboardResponse } from '@nuxia2/shared-types';

/**
 * designer_spec §5-6 & §6 #6
 * - 큰 숫자는 text-earnings-xl
 * - 세대별 bar chart (gen3가 가장 두꺼움)
 * - 3% / 5% / 17% 옆에 "상위 추천인에게 지급" 보조 문구 (gen3)
 * - 3중 인코딩 (색+아이콘+라벨)
 * - confetti/레벨업 이펙트 금지 (투명성 우선)
 */
export interface EarningsCardProps {
  variant: 'expected' | 'payable' | 'withheld' | 'revert';
  data: DashboardResponse;
  className?: string;
}

const VARIANT_META = {
  expected: { label: '이번 달 예상 수익', icon: '📊', color: 'text-foreground' },
  payable: { label: '지급 예정', icon: '✅', color: 'text-referral-earn' },
  withheld: { label: '유보 중', icon: '🕒', color: 'text-referral-withheld' },
  revert: { label: '역정산', icon: '↩', color: 'text-referral-revert' },
} as const;

export function EarningsCard({ variant, data, className }: EarningsCardProps) {
  const meta = VARIANT_META[variant];
  const amount =
    variant === 'expected'
      ? data.expectedThisMonthKrw
      : variant === 'payable'
        ? data.summary.payableKrw
        : variant === 'withheld'
          ? data.summary.withheldKrw
          : data.summary.revertedKrw;

  return (
    <section
      className={cn(
        'rounded-card border border-border bg-background shadow-card p-lg',
        className,
      )}
      aria-labelledby={`earnings-${variant}`}
    >
      <header className="flex items-center gap-sm text-muted-foreground">
        <span aria-hidden>{meta.icon}</span>
        <h2 id={`earnings-${variant}`} className="text-body-sm">
          {meta.label}
        </h2>
      </header>
      <p
        className={cn('mt-sm text-earnings-xl font-extrabold tabular-nums', meta.color)}
        aria-label={`${meta.label} ${formatKrw(amount)}`}
      >
        {formatKrw(amount)}
      </p>

      {variant === 'expected' && <GenerationBars data={data} />}
    </section>
  );
}

function GenerationBars({ data }: { data: DashboardResponse }) {
  const gens = [
    { gen: 1, value: data.byGeneration.gen1.amountKrw, color: 'bg-referral-gen1', rate: '3%' },
    { gen: 2, value: data.byGeneration.gen2.amountKrw, color: 'bg-referral-gen2', rate: '5%' },
    { gen: 3, value: data.byGeneration.gen3.amountKrw, color: 'bg-referral-gen3', rate: '17%' },
  ];
  const max = gens.reduce(
    (m, g) => (BigInt(g.value) > m ? BigInt(g.value) : m),
    0n,
  );
  return (
    <div className="mt-base space-y-sm">
      {gens.map((g) => {
        const ratio =
          max === 0n ? 0 : Number((BigInt(g.value) * 100n) / max) / 100;
        return (
          <div key={g.gen} className="flex items-center gap-sm text-body-sm">
            <span
              className={cn('h-2 w-2 rounded-pill', g.color)}
              aria-hidden
            />
            <span className="w-14 shrink-0">{g.gen}대 · {g.rate}</span>
            <span className="flex-1 h-2 rounded-pill bg-muted overflow-hidden">
              <span
                className={cn('block h-full rounded-pill', g.color)}
                style={{ width: `${Math.max(ratio * 100, g.gen === 3 ? 4 : 2)}%` }}
              />
            </span>
            <span className="w-20 text-right tabular-nums">{formatKrw(g.value)}</span>
          </div>
        );
      })}
      <p className="pt-xs text-caption text-muted-foreground">
        ℹ 3대 17% 는 상위 추천인에게 지급되는 비율입니다
      </p>
    </div>
  );
}
