'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { adminApi } from '@/lib/admin-client';

export interface FlagUserButtonProps {
  userId: string;
  initialFlagged: boolean;
}

/**
 * 관리자 플래그 변경 모달 (사유 입력 후 POST /admin/users/:id/flag).
 * 기본 구현은 native <dialog> 로 shadcn 의존성을 늘리지 않음.
 */
export function FlagUserButton({ userId, initialFlagged }: FlagUserButtonProps) {
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  const [flagged, setFlagged] = React.useState(initialFlagged);
  const [reason, setReason] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const open = () => dialogRef.current?.showModal();
  const close = () => dialogRef.current?.close();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) return;
    setBusy(true);
    try {
      await adminApi.flagUser(userId, { flagged: !flagged, reason });
      setFlagged(!flagged);
      setReason('');
      close();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant={flagged ? 'destructive' : 'secondary'} size="sm" onClick={open}>
        {flagged ? '플래그 해제' : '플래그'}
      </Button>
      <dialog
        ref={dialogRef}
        className="w-full max-w-md rounded-md border border-zinc-700 bg-zinc-900 p-lg text-zinc-100 backdrop:bg-black/60"
        aria-labelledby="flag-title"
      >
        <form onSubmit={submit} className="space-y-sm">
          <h3 id="flag-title" className="text-h4">
            {flagged ? '플래그 해제' : '사용자 플래그'}
          </h3>
          <p className="text-body-sm text-zinc-400">
            사유는 감사 로그에 기록됩니다. (최소 1자)
          </p>
          <label className="block">
            <span className="mb-xs block text-caption text-zinc-400">사유</span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              rows={3}
              className="w-full rounded-md border border-zinc-700 bg-zinc-950 p-sm text-body-sm text-zinc-100 focus:border-accent focus:outline-none"
            />
          </label>
          <div className="flex justify-end gap-sm">
            <Button type="button" variant="ghost" size="sm" onClick={close}>
              취소
            </Button>
            <Button type="submit" variant="accent" size="sm" loading={busy} disabled={!reason.trim()}>
              확인
            </Button>
          </div>
        </form>
      </dialog>
    </>
  );
}
