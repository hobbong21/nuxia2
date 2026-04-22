'use client';

/**
 * AuditLogDetailModal — v0.5 M2-FE.
 *
 * AuditLog 행 클릭 시 표시되는 상세 모달.
 * - 메타 필드 표시 (시각, 종류, 행위자, 대상, 요약)
 * - before/after JSON 블록 두 개. key 차이가 있으면 색으로 강조.
 */
import * as React from 'react';
import type { AuditLog } from '@/lib/admin-client';
import { AuditKindBadge } from './AuditKindBadge';
import { formatDate } from '@/lib/format';

export interface AuditLogDetailModalProps {
  open: boolean;
  log: AuditLog | null;
  onClose: () => void;
}

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    const date = formatDate(iso);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `${date} ${hh}:${mm}:${ss}`;
  } catch {
    return iso;
  }
}

/** before/after 의 key union. 어느 한쪽에만 존재하거나 값이 다른 key는 "diff" 취급. */
function computeDiffKeys(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
): Set<string> {
  const out = new Set<string>();
  const a = before ?? {};
  const b = after ?? {};
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    if (JSON.stringify((a as Record<string, unknown>)[k]) !== JSON.stringify((b as Record<string, unknown>)[k])) {
      out.add(k);
    }
  }
  return out;
}

function JsonBlock({
  data,
  diffKeys,
  sideLabel,
}: {
  data: Record<string, unknown> | null | undefined;
  diffKeys: Set<string>;
  sideLabel: 'before' | 'after';
}) {
  if (!data) {
    return (
      <div className="rounded-md border border-zinc-800 bg-zinc-950 p-sm text-caption text-zinc-500">
        (없음)
      </div>
    );
  }
  const entries = Object.entries(data);
  return (
    <pre
      aria-label={`${sideLabel} JSON`}
      className="overflow-x-auto rounded-md border border-zinc-800 bg-zinc-950 p-sm text-caption text-zinc-300"
    >
{'{\n'}
      {entries.map(([k, v], i) => {
        const changed = diffKeys.has(k);
        const suffix = i === entries.length - 1 ? '' : ',';
        return (
          <span
            key={k}
            className={
              changed
                ? sideLabel === 'before'
                  ? 'block text-red-300'
                  : 'block text-green-300'
                : 'block'
            }
          >
            {`  "${k}": ${JSON.stringify(v)}${suffix}`}
          </span>
        );
      })}
      {'}'}
    </pre>
  );
}

export function AuditLogDetailModal({ open, log, onClose }: AuditLogDetailModalProps) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !log) return null;

  const diffKeys = computeDiffKeys(log.before, log.after);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="audit-detail-title"
      className="fixed inset-0 z-modal flex items-center justify-center bg-black/70 px-base"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl rounded-card border border-zinc-800 bg-zinc-950 p-lg shadow-elevated">
        <header className="mb-base flex items-center justify-between gap-sm">
          <div className="flex items-center gap-sm">
            <h2 id="audit-detail-title" className="text-h4 text-white">
              감사 로그 상세
            </h2>
            <AuditKindBadge kind={log.kind} />
          </div>
          <button
            type="button"
            aria-label="닫기"
            onClick={onClose}
            className="h-11 w-11 text-zinc-400 hover:text-white"
          >
            ✕
          </button>
        </header>

        <dl className="mb-base grid grid-cols-[auto_1fr] gap-x-md gap-y-xs text-body-sm">
          <dt className="text-zinc-500">시각</dt>
          <dd className="text-zinc-200 tabular-nums">{formatDateTime(log.createdAt)}</dd>

          <dt className="text-zinc-500">행위자</dt>
          <dd className="text-zinc-200">
            {log.actorNickname ?? <span className="text-zinc-500">—</span>}{' '}
            <code className="text-caption text-zinc-500">({log.actorUserId})</code>
          </dd>

          <dt className="text-zinc-500">대상</dt>
          <dd className="text-zinc-200">
            <span className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 text-caption uppercase text-zinc-300">
              {log.targetType}
            </span>{' '}
            <code className="text-caption text-zinc-400">{log.targetId}</code>
          </dd>

          <dt className="text-zinc-500">요약</dt>
          <dd className="text-zinc-200">
            {log.diffSummary ?? <span className="text-zinc-500">—</span>}
          </dd>

          <dt className="text-zinc-500">로그 ID</dt>
          <dd><code className="text-caption text-zinc-500">{log.id}</code></dd>
        </dl>

        <section aria-label="변경 내역" className="space-y-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-body-sm font-semibold text-zinc-300">변경 내역</h3>
            {diffKeys.size > 0 && (
              <span className="text-caption text-zinc-500">
                변경된 키 {diffKeys.size}개
              </span>
            )}
          </div>
          <div className="grid gap-sm md:grid-cols-2">
            <div className="space-y-xs">
              <div className="text-caption font-semibold uppercase tracking-wide text-red-300">
                Before
              </div>
              <JsonBlock data={log.before} diffKeys={diffKeys} sideLabel="before" />
            </div>
            <div className="space-y-xs">
              <div className="text-caption font-semibold uppercase tracking-wide text-green-300">
                After
              </div>
              <JsonBlock data={log.after} diffKeys={diffKeys} sideLabel="after" />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
