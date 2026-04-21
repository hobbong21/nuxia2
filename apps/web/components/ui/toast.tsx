'use client';

/**
 * 간단 토스트 stub.
 * 실제 프로덕션에서는 shadcn/ui toast 또는 sonner로 교체 예정.
 */
import * as React from 'react';

type ToastVariant = 'success' | 'warning' | 'error' | 'info';
interface Toast {
  id: number;
  message: string;
  variant: ToastVariant;
}

const ToastContext = React.createContext<{
  show: (message: string, variant?: ToastVariant) => void;
} | null>(null);

export function Toaster({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const show = React.useCallback((message: string, variant: ToastVariant = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, variant === 'error' ? 4000 : 2500);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div
        role="region"
        aria-live="polite"
        className="fixed bottom-[calc(56px+env(safe-area-inset-bottom)+16px)] left-1/2 -translate-x-1/2 z-toast flex flex-col gap-sm pointer-events-none max-w-[calc(100vw-32px)]"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            aria-live={t.variant === 'error' ? 'assertive' : 'polite'}
            className={[
              'pointer-events-auto rounded-card px-base py-sm text-body text-white shadow-elevated',
              t.variant === 'success' && 'bg-status-success',
              t.variant === 'warning' && 'bg-status-warning',
              t.variant === 'error' && 'bg-status-error',
              t.variant === 'info' && 'bg-primary',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) {
    return {
      show: (_msg: string, _variant?: ToastVariant) => {
        /* no-op if not wrapped */
      },
    };
  }
  return ctx;
}
