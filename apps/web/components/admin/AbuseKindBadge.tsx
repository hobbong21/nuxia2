import type { AbuseKind } from '@/lib/admin-client';
import { cn } from '@/lib/utils';

/**
 * designer_spec §8-2 — 색+아이콘+라벨 3중 인코딩.
 * 관리자 다크 테이블 위에서 가독성을 유지하는 배경/테두리 조합을 사용.
 */
const MAP: Record<AbuseKind, { label: string; icon: string; cls: string }> = {
  SELF_REFERRAL: {
    label: '셀프레퍼럴',
    icon: '🚫',
    cls: 'bg-red-950 text-red-200 border-red-600',
  },
  CIRCULAR: {
    label: '순환',
    icon: '♻️',
    cls: 'bg-orange-950 text-orange-200 border-orange-600',
  },
  DUPLICATE_CI: {
    label: '중복 CI',
    icon: '⚠',
    cls: 'bg-yellow-950 text-yellow-200 border-yellow-600',
  },
  STAFF_REFERRAL_FORBIDDEN: {
    label: '임직원',
    icon: '⛔',
    cls: 'bg-zinc-800 text-zinc-300 border-zinc-600',
  },
  WITHDRAW_REJOIN_COOLDOWN: {
    label: '쿨다운',
    icon: '⏳',
    cls: 'bg-purple-950 text-purple-200 border-purple-600',
  },
};

export function AbuseKindBadge({ kind }: { kind: AbuseKind }) {
  const m = MAP[kind];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-pill border px-2 py-0.5 text-caption font-semibold',
        m.cls,
      )}
      aria-label={`어뷰징 종류: ${m.label}`}
    >
      <span aria-hidden>{m.icon}</span>
      <span>{m.label}</span>
    </span>
  );
}

export const ABUSE_KINDS = [
  'SELF_REFERRAL',
  'CIRCULAR',
  'DUPLICATE_CI',
  'STAFF_REFERRAL_FORBIDDEN',
  'WITHDRAW_REJOIN_COOLDOWN',
] as const;
