import Link from 'next/link';
import { adminApi, type AbuseKind } from '@/lib/admin-client';
import { DataTable, type DataTableColumn } from '@/components/admin/DataTable';
import { AbuseKindBadge, ABUSE_KINDS } from '@/components/admin/AbuseKindBadge';
import { formatDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

const KIND_LABELS: Record<AbuseKind, string> = {
  SELF_REFERRAL: '셀프',
  CIRCULAR: '순환',
  DUPLICATE_CI: '중복 CI',
  STAFF_REFERRAL_FORBIDDEN: '임직원',
  WITHDRAW_REJOIN_COOLDOWN: '쿨다운',
};

type AbuseRow = Awaited<ReturnType<typeof adminApi.getAbuseLogs>>['items'][number];

export default async function AbuseLogsPage({
  searchParams,
}: {
  searchParams: { kind?: string; cursor?: string };
}) {
  const kind = (ABUSE_KINDS as readonly string[]).includes(searchParams.kind ?? '')
    ? (searchParams.kind as AbuseKind)
    : undefined;
  const cursor = searchParams.cursor;
  const { items, nextCursor } = await adminApi.getAbuseLogs({ kind, cursor });

  const columns: DataTableColumn<AbuseRow>[] = [
    { key: 'createdAt', header: '시각', render: (r) => <span className="text-zinc-400">{formatDate(r.createdAt)}</span> },
    { key: 'kind',      header: '종류', render: (r) => <AbuseKindBadge kind={r.kind} /> },
    { key: 'user',      header: '대상', render: (r) => r.userNickname ?? <span className="text-zinc-500">—</span> },
    { key: 'referrer',  header: '추천인', render: (r) => r.referrerNickname ?? <span className="text-zinc-500">—</span> },
    { key: 'reason',    header: '사유', render: (r) => <span className="text-zinc-300">{r.reason}</span> },
  ];

  return (
    <div className="space-y-lg">
      <header>
        <h1 className="text-h2">어뷰징 로그</h1>
        <p className="text-body-sm text-zinc-400">
          레퍼럴 체인 검증 실패 건. kind 로 필터링.
        </p>
      </header>

      <DataTable
        caption="어뷰징 로그"
        rows={items}
        rowKey={(r) => r.id}
        columns={columns}
        emptyLabel="해당 kind 의 로그가 없습니다."
        nextCursor={nextCursor}
        nextHref={(c) =>
          `/admin/abuse-logs?${new URLSearchParams({
            ...(kind ? { kind } : {}),
            cursor: c,
          }).toString()}`
        }
        toolbar={
          <>
            <span className="text-caption text-zinc-400">필터:</span>
            <FilterChip href="/admin/abuse-logs" active={!kind}>
              전체
            </FilterChip>
            {ABUSE_KINDS.map((k) => (
              <FilterChip
                key={k}
                href={`/admin/abuse-logs?kind=${k}`}
                active={kind === k}
              >
                {KIND_LABELS[k]}
              </FilterChip>
            ))}
          </>
        }
      />
    </div>
  );
}

function FilterChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={
        active
          ? 'rounded-pill border border-accent bg-accent/20 px-3 py-1 text-caption font-semibold text-white'
          : 'rounded-pill border border-zinc-700 px-3 py-1 text-caption text-zinc-300 hover:border-zinc-500 hover:text-white'
      }
    >
      {children}
    </Link>
  );
}
