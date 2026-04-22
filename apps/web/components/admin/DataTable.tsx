import * as React from 'react';
import { cn } from '@/lib/utils';

export interface DataTableColumn<T> {
  key: string;
  header: React.ReactNode;
  /** 숫자/금액은 `align: 'right'` 권장 (규약 §M1-5) */
  align?: 'left' | 'right' | 'center';
  className?: string;
  render: (row: T) => React.ReactNode;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  /** 빈 상태 메시지 */
  emptyLabel?: string;
  /** 접근성 caption */
  caption?: string;
  /** 필터 영역 children (예: kind 칩) */
  toolbar?: React.ReactNode;
  /** "더 불러오기" 커서 */
  nextCursor?: string | null;
  /** nextCursor 링크 href 빌더 (페이지 내 Link 로 처리) */
  nextHref?: (nextCursor: string) => string;
  rowKey: (row: T) => string;
}

/**
 * 관리자 전용 조밀 테이블. h-10 행, 홀짝 배경, 숫자 우측 정렬.
 * 커서 페이지네이션은 단순 "더 불러오기" 링크로 처리 (SSR 친화).
 */
export function DataTable<T>({
  columns,
  rows,
  emptyLabel = '데이터가 없습니다.',
  caption,
  toolbar,
  nextCursor,
  nextHref,
  rowKey,
}: DataTableProps<T>) {
  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-950">
      {toolbar && (
        <div className="flex flex-wrap items-center gap-sm border-b border-zinc-800 p-sm">
          {toolbar}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-body-sm">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900 text-zinc-400">
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={cn(
                    'h-10 px-3 text-caption font-semibold uppercase tracking-wide',
                    c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left',
                    c.className,
                  )}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="h-24 px-3 text-center text-zinc-500"
                >
                  {emptyLabel}
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr
                  key={rowKey(row)}
                  className={cn(
                    'border-b border-zinc-900 text-zinc-200 hover:bg-zinc-900',
                    i % 2 === 1 && 'bg-zinc-950/60',
                  )}
                >
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={cn(
                        'h-10 px-3 align-middle',
                        c.align === 'right' ? 'text-right tabular-nums' : c.align === 'center' ? 'text-center' : 'text-left',
                        c.className,
                      )}
                    >
                      {c.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {nextCursor && nextHref && (
        <div className="flex justify-center border-t border-zinc-800 p-sm">
          <a
            href={nextHref(nextCursor)}
            className="text-body-sm text-zinc-300 underline-offset-4 hover:text-white hover:underline"
          >
            더 불러오기 →
          </a>
        </div>
      )}
    </div>
  );
}
