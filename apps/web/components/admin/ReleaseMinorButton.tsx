'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { adminApi } from '@/lib/admin-client';

export interface ReleaseMinorButtonProps {
  userId: string;
  status: string;
}

/**
 * T7 미성년 수동 해제 — MINOR_HOLD 상태일 때만 활성.
 * 성공 후 페이지 리로드로 상태 갱신 (Next.js 13+ App Router; 가벼운 구현).
 */
export function ReleaseMinorButton({ userId, status }: ReleaseMinorButtonProps) {
  const [busy, setBusy] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const eligible = status === 'MINOR_HOLD';

  async function onClick() {
    if (!eligible) return;
    if (!confirm('미성년 보류를 해제하시겠습니까? 감사 로그에 기록됩니다.')) return;
    setBusy(true);
    try {
      await adminApi.releaseMinor(userId);
      setDone(true);
      window.location.reload();
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return <span className="text-body-sm text-green-400">해제 완료</span>;
  }
  return (
    <Button
      variant="accent"
      size="sm"
      onClick={onClick}
      loading={busy}
      disabled={!eligible}
      aria-label="만 19세 도달 수동 해제"
    >
      {eligible ? '미성년 해제' : '해제 불가'}
    </Button>
  );
}
