import type { AuditLogKind } from '@/lib/admin-client';
import { cn } from '@/lib/utils';

/**
 * v0.5 M2-FE — AuditLog kind 3중 인코딩 뱃지(색 + 아이콘 + 텍스트).
 *
 * AbuseKindBadge와 동일 규약: designer_spec §8-2. 관리자 다크 테이블 위에서
 * 가독성을 유지하는 배경/테두리 조합을 사용.
 */
const MAP: Record<AuditLogKind, { label: string; icon: string; cls: string }> = {
  USER_FLAG: {
    label: '플래그',
    icon: '🚩',
    cls: 'bg-orange-950 text-orange-200 border-orange-600',
  },
  USER_RELEASE_MINOR: {
    label: '미성년 해제',
    icon: '✓',
    cls: 'bg-green-950 text-green-200 border-green-600',
  },
  USER_MARK_STAFF: {
    label: '임직원 지정',
    icon: '🏢',
    cls: 'bg-zinc-800 text-zinc-200 border-zinc-600',
  },
  USER_SUSPEND: {
    label: '계정 정지',
    icon: '⛔',
    cls: 'bg-red-950 text-red-200 border-red-600',
  },
  PAYOUT_RUN: {
    label: '정산 실행',
    icon: '▶',
    cls: 'bg-blue-950 text-blue-200 border-blue-600',
  },
  PAYOUT_RELEASE: {
    label: '정산 해제',
    icon: '✅',
    cls: 'bg-purple-950 text-purple-200 border-purple-600',
  },
};

export function AuditKindBadge({ kind }: { kind: AuditLogKind }) {
  const m = MAP[kind];
  if (!m) {
    // 방어: 신규 kind가 BE에만 추가된 경우 raw value를 표시.
    return (
      <span className="inline-flex items-center gap-1 rounded-pill border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-caption font-semibold text-zinc-300">
        <span aria-hidden>•</span>
        <span>{kind}</span>
      </span>
    );
  }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-pill border px-2 py-0.5 text-caption font-semibold',
        m.cls,
      )}
      aria-label={`감사 로그 종류: ${m.label}`}
    >
      <span aria-hidden>{m.icon}</span>
      <span>{m.label}</span>
    </span>
  );
}

export const AUDIT_KINDS = [
  'USER_FLAG',
  'USER_RELEASE_MINOR',
  'USER_MARK_STAFF',
  'USER_SUSPEND',
  'PAYOUT_RUN',
  'PAYOUT_RELEASE',
] as const satisfies readonly AuditLogKind[];

export const AUDIT_KIND_LABEL: Record<AuditLogKind, string> = Object.fromEntries(
  (Object.entries(MAP) as [AuditLogKind, { label: string }][]).map(([k, v]) => [k, v.label]),
) as Record<AuditLogKind, string>;
