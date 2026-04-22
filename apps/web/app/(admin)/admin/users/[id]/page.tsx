import Link from 'next/link';
import { notFound } from 'next/navigation';
import { adminApi } from '@/lib/admin-client';
import { UserTreePanel } from '@/components/admin/UserTreePanel';
import { FlagUserButton } from '@/components/admin/FlagUserButton';
import { ReleaseMinorButton } from '@/components/admin/ReleaseMinorButton';
import { formatDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function AdminUserDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const [user, tree] = await Promise.all([
    adminApi.getUser(params.id),
    adminApi.getUserTree(params.id),
  ]);
  if (!user) notFound();

  return (
    <div className="space-y-lg">
      <header className="flex items-start justify-between gap-lg">
        <div>
          <nav className="text-caption text-zinc-500">
            <Link href="/admin/users" className="hover:text-zinc-300">사용자</Link>
            <span className="mx-1">/</span>
            <span className="text-zinc-300">{user.nickname}</span>
          </nav>
          <h1 className="mt-xs text-h2">{user.nickname}</h1>
          <p className="text-body-sm text-zinc-400">
            {user.email} · <code className="text-zinc-300">{user.referralCode}</code>
          </p>
        </div>
        <div className="flex items-center gap-sm">
          <FlagUserButton userId={user.id} initialFlagged={user.flagged} />
          <ReleaseMinorButton userId={user.id} status={user.status} />
        </div>
      </header>

      <section className="grid gap-base sm:grid-cols-2 lg:grid-cols-4">
        <KV label="역할" value={user.role} />
        <KV label="상태" value={user.status} />
        <KV label="본인인증" value={user.identityVerified ? '완료' : '미완료'} />
        <KV label="가입일" value={formatDate(user.createdAt)} />
      </section>

      <UserTreePanel tree={tree} flaggedUserIds={user.flagged ? [user.id] : []} />

      <section className="rounded-md border border-zinc-800 bg-zinc-950 p-base">
        <h3 className="text-h4">관리자 액션 이력</h3>
        <p className="mt-sm text-body-sm text-zinc-500">
          TODO: /admin/users/:id/audit-log 연동 (v0.3 이후).
        </p>
      </section>
    </div>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-950 p-base">
      <p className="text-caption text-zinc-500">{label}</p>
      <p className="mt-xs text-body font-semibold text-zinc-100">{value}</p>
    </div>
  );
}
