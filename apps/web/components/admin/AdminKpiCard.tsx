import { cn } from '@/lib/utils';

export interface AdminKpiCardProps {
  label: string;
  value: string;
  sub?: string;
  tone?: 'default' | 'warning' | 'danger' | 'success';
}

const TONE: Record<NonNullable<AdminKpiCardProps['tone']>, string> = {
  default: 'border-zinc-800',
  warning: 'border-yellow-700',
  danger: 'border-red-700',
  success: 'border-green-700',
};

export function AdminKpiCard({ label, value, sub, tone = 'default' }: AdminKpiCardProps) {
  return (
    <div
      className={cn(
        'rounded-md border bg-zinc-950 p-lg text-zinc-100',
        TONE[tone],
      )}
    >
      <p className="text-caption uppercase tracking-wide text-zinc-400">{label}</p>
      <p className="mt-sm text-earnings-xl font-extrabold tabular-nums">{value}</p>
      {sub && <p className="mt-xs text-body-sm text-zinc-400">{sub}</p>}
    </div>
  );
}
