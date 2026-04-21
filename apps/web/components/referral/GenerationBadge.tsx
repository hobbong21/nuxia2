import * as React from 'react';
import { cn } from '@/lib/utils';
import { bpsToPercent } from '@/lib/format';

export interface GenerationBadgeProps {
  generation: 1 | 2 | 3;
  className?: string;
  withHint?: boolean;
}

const GEN_COLOR = {
  1: 'bg-referral-gen1 text-white',
  2: 'bg-referral-gen2 text-white',
  3: 'bg-referral-gen3 text-white',
};

const GEN_BPS = { 1: 300, 2: 500, 3: 1700 } as const;

/**
 * designer_spec §6 #7 — 색·라벨 세대 뱃지.
 * gen3(17%)는 withHint=true 시 "상위 추천인에게 지급" 보조 문구를 동반해야 함.
 */
export function GenerationBadge({ generation, className, withHint }: GenerationBadgeProps) {
  const bps = GEN_BPS[generation];
  return (
    <span className={cn('inline-flex flex-col gap-[2px]', className)}>
      <span
        className={cn(
          'inline-flex h-6 items-center gap-xs rounded-pill px-sm text-caption font-semibold',
          GEN_COLOR[generation],
        )}
        aria-label={`${generation}대 ${bpsToPercent(bps)}`}
      >
        <span aria-hidden className="h-1.5 w-1.5 rounded-pill bg-white/80" />
        {generation}대 · {bpsToPercent(bps)}
      </span>
      {withHint && generation === 3 && (
        <span className="text-caption text-muted-foreground">
          상위 추천인에게 지급되는 비율입니다
        </span>
      )}
    </span>
  );
}
