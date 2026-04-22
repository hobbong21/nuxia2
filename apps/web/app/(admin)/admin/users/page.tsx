import Link from 'next/link';
import { adminApi } from '@/lib/admin-client';
import { DataTable, type DataTableColumn } from '@/components/admin/DataTable';
import { formatDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

type UserRow = Awaited<ReturnType<typeof adminApi.getUsers>>['items'][number];

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: { query?: string; cursor?: string };
}) {
  const query = searchParams.query?.trim();
  const cursor = searchParams.cursor;
  const { items, nextCursor } = await adminApi.getUsers({ query, cursor });

  const columns: DataTableColumn<UserRow>[] = [
    {
      key: 'nickname',
      header: '닉네임',
      render: (r) => (
        <Link href={`/admin/users/${r.id}`} className="text-white hover:underline">
          {r.nickname}
          {r.flagged && (
            <span className="ml-xs inline-block h-2 w-2 rounded-pill bg-red-500" aria-label="플래그됨" />
          )}
        </Link>
      ),
    },
    { key: 'email', header: '이메일', render: (r) => <span className="text-zinc-400">{r.email}</span> },
    { key: 'role', header: '역할', render: (r) => <RoleBadge value={r.role} /> },
    { key: 'status', header: '상태', render: (r) => <StatusBadge value={r.status} /> },
    { key: 'code', header: '추천코드', render: (r) => <code className="text-caption text-zinc-300">{r.referralCode}</code> },
    { key: 'ci', header: '본인인증', align: 'center', render: (r) => (r.identityVerified ? '✅' : '—') },
    { key: 'createdAt', header: '가입일', align: 'right', render: (r) => formatDate(r.createdAt) },
  ];

  return (
    <div className="space-y-lg">
      <header className="space-y-sm">
        <h1 className="text-h2">사용자</h1>
        <form action="/admin/users" className="flex gap-sm">
          <input
            type="search"
            name="query"
            defaultValue={query ?? ''}
            placeholder="닉네임 / 이메일 / 추천코드 검색"
            className="h-10 w-full max-w-md rounded-md border border-zinc-700 bg-zinc-900 px-md text-body-sm text-zinc-100 placeholder:text-zinc-500 focus:border-accent focus:outline-none"
          />
          <button
            type="submit"
            className="h-10 rounded-md bg-accent px-md text-body-sm font-semibold text-accent-foreground hover:bg-accent-hover"
          >
            검색
          </button>
        </form>
      </header>

      <DataTable
        caption="사용자 목록"
        rows={items}
        rowKey={(r) => r.id}
        columns={columns}
        emptyLabel="검색 결과가 없습니다."
        nextCursor={nextCursor}
        nextHref={(c) =>
          `/admin/users?${new URLSearchParams({
            ...(query ? { query } : {}),
            cursor: c,
          }).toString()}`
        }
      />
    </div>
  );
}

function RoleBadge({ value }: { value: UserRow['role'] }) {
  const cls =
    value === 'ADMIN'
      ? 'bg-purple-950 text-purple-200 border-purple-700'
      : value === 'STAFF' || value === 'STAFF_FAMILY'
        ? 'bg-zinc-800 text-zinc-200 border-zinc-600'
        : 'bg-zinc-900 text-zinc-300 border-zinc-700';
  return <span className={`inline-flex rounded-pill border px-2 py-0.5 text-caption font-semibold ${cls}`}>{value}</span>;
}

function StatusBadge({ value }: { value: UserRow['status'] }) {
  const cls =
    value === 'ACTIVE'
      ? 'bg-green-950 text-green-200 border-green-700'
      : value === 'MINOR_HOLD'
        ? 'bg-yellow-950 text-yellow-200 border-yellow-700'
        : value === 'SUSPENDED' || value === 'UNDER_REVIEW'
          ? 'bg-orange-950 text-orange-200 border-orange-700'
          : value === 'BANNED' || value === 'WITHDRAWN'
            ? 'bg-red-950 text-red-200 border-red-700'
            : 'bg-zinc-900 text-zinc-300 border-zinc-700';
  return <span className={`inline-flex rounded-pill border px-2 py-0.5 text-caption font-semibold ${cls}`}>{value}</span>;
}
