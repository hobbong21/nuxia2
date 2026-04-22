'use client';

/**
 * /admin/audit-logs — v0.5 M2-FE.
 *
 * 관리자 감사 로그 조회 화면.
 *  - kind 드롭다운 필터 (전체 + 6 kind)
 *  - actor 닉네임 substring 검색
 *  - targetId 검색
 *  - 커서 페이지네이션 ("더 보기" 버튼)
 *  - 행 클릭 시 AuditLogDetailModal
 */
import * as React from 'react';
import {
  adminApi,
  type AuditLog,
  type AuditLogKind,
  type Cursor,
} from '@/lib/admin-client';
import {
  AuditKindBadge,
  AUDIT_KINDS,
  AUDIT_KIND_LABEL,
} from '@/components/admin/AuditKindBadge';
import { AuditLogDetailModal } from '@/components/admin/AuditLogDetailModal';
import { formatDate } from '@/lib/format';

export default function AuditLogsPage() {
  const [kind, setKind] = React.useState<AuditLogKind | ''>('');
  const [actor, setActor] = React.useState('');
  const [targetId, setTargetId] = React.useState('');
  // 실제 조회 트리거 (검색 버튼 클릭 시점에 커밋)
  const [committed, setCommitted] = React.useState({
    kind: '' as AuditLogKind | '',
    actor: '',
    targetId: '',
  });

  const [items, setItems] = React.useState<AuditLog[]>([]);
  const [nextCursor, setNextCursor] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [loadingMore, setLoadingMore] = React.useState(false);

  const [selected, setSelected] = React.useState<AuditLog | null>(null);
  const [modalOpen, setModalOpen] = React.useState(false);

  const fetchPage = React.useCallback(
    async (cursor?: string, append = false) => {
      if (append) setLoadingMore(true);
      else setLoading(true);
      try {
        const res: Cursor<AuditLog> = await adminApi.getAuditLogs({
          kind: committed.kind || undefined,
          actor: committed.actor.trim() || undefined,
          targetId: committed.targetId.trim() || undefined,
          cursor,
        });
        setNextCursor(res.nextCursor);
        setItems((prev) => (append ? [...prev, ...res.items] : res.items));
      } catch (e) {
        console.error('[audit-logs] fetch failed', e);
        if (!append) setItems([]);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [committed],
  );

  React.useEffect(() => {
    void fetchPage(undefined, false);
  }, [fetchPage]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCommitted({ kind, actor, targetId });
  };

  const onReset = () => {
    setKind('');
    setActor('');
    setTargetId('');
    setCommitted({ kind: '', actor: '', targetId: '' });
  };

  const openDetail = (log: AuditLog) => {
    setSelected(log);
    setModalOpen(true);
  };

  return (
    <div className="space-y-lg">
      <header className="space-y-sm">
        <h1 className="text-h2">감사 로그</h1>
        <p className="text-body-sm text-zinc-400">
          관리자의 사용자/정산 조작 이력. kind · 행위자 · 대상으로 필터링.
        </p>
      </header>

      <form
        onSubmit={onSubmit}
        className="flex flex-wrap items-end gap-sm rounded-md border border-zinc-800 bg-zinc-950 p-sm"
        aria-label="감사 로그 필터"
      >
        <label className="flex flex-col gap-xs">
          <span className="text-caption text-zinc-400">종류</span>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as AuditLogKind | '')}
            className="h-11 min-h-[44px] rounded-md border border-zinc-700 bg-zinc-900 px-md text-body-sm text-zinc-100 focus:border-accent focus:outline-none"
          >
            <option value="">전체</option>
            {AUDIT_KINDS.map((k) => (
              <option key={k} value={k}>
                {AUDIT_KIND_LABEL[k]} ({k})
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-xs">
          <span className="text-caption text-zinc-400">행위자 (닉네임)</span>
          <input
            type="search"
            value={actor}
            onChange={(e) => setActor(e.target.value)}
            placeholder="예: 관리자A"
            className="h-11 min-h-[44px] w-56 rounded-md border border-zinc-700 bg-zinc-900 px-md text-body-sm text-zinc-100 placeholder:text-zinc-500 focus:border-accent focus:outline-none"
          />
        </label>

        <label className="flex flex-col gap-xs">
          <span className="text-caption text-zinc-400">대상 ID</span>
          <input
            type="search"
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            placeholder="user/payout id"
            className="h-11 min-h-[44px] w-56 rounded-md border border-zinc-700 bg-zinc-900 px-md text-body-sm text-zinc-100 placeholder:text-zinc-500 focus:border-accent focus:outline-none"
          />
        </label>

        <div className="flex gap-xs">
          <button
            type="submit"
            className="h-11 min-h-[44px] rounded-md bg-accent px-md text-body-sm font-semibold text-accent-foreground hover:bg-accent-hover"
          >
            검색
          </button>
          <button
            type="button"
            onClick={onReset}
            className="h-11 min-h-[44px] rounded-md border border-zinc-700 px-md text-body-sm text-zinc-300 hover:border-zinc-500 hover:text-white"
          >
            초기화
          </button>
        </div>
      </form>

      <div className="rounded-md border border-zinc-800 bg-zinc-950">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-body-sm">
            <caption className="sr-only">감사 로그</caption>
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900 text-zinc-400">
                <th scope="col" className="h-10 px-3 text-left text-caption font-semibold uppercase tracking-wide">시각</th>
                <th scope="col" className="h-10 px-3 text-left text-caption font-semibold uppercase tracking-wide">종류</th>
                <th scope="col" className="h-10 px-3 text-left text-caption font-semibold uppercase tracking-wide">행위자</th>
                <th scope="col" className="h-10 px-3 text-left text-caption font-semibold uppercase tracking-wide">대상</th>
                <th scope="col" className="h-10 px-3 text-left text-caption font-semibold uppercase tracking-wide">요약</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="h-24 px-3 text-center text-zinc-500">
                    불러오는 중…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="h-24 px-3 text-center text-zinc-500">
                    조건에 맞는 로그가 없습니다.
                  </td>
                </tr>
              ) : (
                items.map((row, i) => (
                  <tr
                    key={row.id}
                    tabIndex={0}
                    role="button"
                    aria-label={`${row.kind} 감사 로그 상세 보기`}
                    onClick={() => openDetail(row)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openDetail(row);
                      }
                    }}
                    className={
                      'cursor-pointer border-b border-zinc-900 text-zinc-200 transition-colors hover:bg-zinc-900 focus:bg-zinc-900 focus:outline-none ' +
                      (i % 2 === 1 ? 'bg-zinc-950/60' : '')
                    }
                  >
                    <td className="h-10 px-3 align-middle text-zinc-400 tabular-nums">
                      {formatDate(row.createdAt)}
                    </td>
                    <td className="h-10 px-3 align-middle">
                      <AuditKindBadge kind={row.kind} />
                    </td>
                    <td className="h-10 px-3 align-middle">
                      {row.actorNickname ?? <span className="text-zinc-500">—</span>}
                    </td>
                    <td className="h-10 px-3 align-middle">
                      <span className="text-caption uppercase text-zinc-500">{row.targetType}</span>{' '}
                      <code className="text-caption text-zinc-300">{row.targetId}</code>
                    </td>
                    <td className="h-10 px-3 align-middle text-zinc-300">
                      <span className="line-clamp-1">
                        {row.diffSummary ?? <span className="text-zinc-500">—</span>}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {nextCursor && (
          <div className="flex justify-center border-t border-zinc-800 p-sm">
            <button
              type="button"
              disabled={loadingMore}
              onClick={() => void fetchPage(nextCursor, true)}
              className="h-11 min-h-[44px] rounded-md border border-zinc-700 px-md text-body-sm text-zinc-300 hover:border-zinc-500 hover:text-white disabled:opacity-50"
            >
              {loadingMore ? '불러오는 중…' : '더 보기'}
            </button>
          </div>
        )}
      </div>

      <AuditLogDetailModal
        open={modalOpen}
        log={selected}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}
