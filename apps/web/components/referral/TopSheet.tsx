'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { pushBackHandler } from '@/lib/native/back-button';

/**
 * designer_spec §5-5 & §6 #11 — 결제 위젯 컨테이너.
 * - lerp 500ms 등장, drag handle로 닫기
 * - Android 하드웨어 백 버튼과 연동 (pushBackHandler)
 */
export interface TopSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export function TopSheet({ open, onClose, title, children }: TopSheetProps) {
  React.useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const unregister = pushBackHandler(() => {
      onClose();
      return true;
    });
    return () => {
      document.body.style.overflow = prevOverflow;
      unregister();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-sheet" role="dialog" aria-modal="true" aria-label={title}>
      <button
        type="button"
        aria-label="닫기"
        onClick={onClose}
        className="absolute inset-0 bg-primary/40 transition-opacity duration-smooth ease-smooth"
      />
      <div
        className={cn(
          'absolute inset-x-0 bottom-0 max-h-[85vh] rounded-t-xl bg-background pb-safe',
          'shadow-sheet transition-transform duration-lerp ease-lerp',
        )}
        style={{ transform: 'translateY(0%)' }}
      >
        <div className="flex justify-center pt-sm" aria-hidden>
          <span className="h-1 w-10 rounded-pill bg-border-strong" />
        </div>
        {title && (
          <div className="px-base pb-sm text-center text-lead font-semibold">
            {title}
          </div>
        )}
        <div className="overflow-auto px-base pb-base" style={{ maxHeight: 'calc(85vh - 56px)' }}>
          {children}
        </div>
      </div>
    </div>
  );
}
