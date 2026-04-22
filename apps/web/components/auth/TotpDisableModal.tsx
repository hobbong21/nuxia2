'use client';

/**
 * TotpDisableModal — 2FA 비활성화 모달.
 *
 * 현재 TOTP 코드를 요구한 뒤 POST /auth/2fa/disable 호출.
 */
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { authApi, AuthClientError } from '@/lib/auth-client';
import { TotpField } from './TotpField';

export interface TotpDisableModalProps {
  open: boolean;
  onClose: () => void;
  onDisabled: () => void;
}

export function TotpDisableModal({ open, onClose, onDisabled }: TotpDisableModalProps) {
  const toast = useToast();
  const [code, setCode] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) {
      setCode('');
      setErr(null);
      setLoading(false);
    }
  }, [open]);

  const submit = async (explicit?: string) => {
    const c = (explicit ?? code).replace(/\D/g, '');
    if (c.length !== 6) return;
    setLoading(true);
    setErr(null);
    try {
      await authApi.disable2FA(c);
      toast.show('2단계 인증이 비활성화되었습니다.', 'info');
      onDisabled();
      onClose();
    } catch (e) {
      setErr(e instanceof AuthClientError ? e.message : '비활성화에 실패했습니다.');
      setCode('');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="totp-disable-title"
      className="fixed inset-0 z-modal flex items-center justify-center bg-black/60 px-base"
    >
      <div className="w-full max-w-md rounded-card bg-background p-lg shadow-elevated">
        <header className="mb-base flex items-center justify-between">
          <h2 id="totp-disable-title" className="text-h4">2단계 인증 비활성화</h2>
          <button
            type="button"
            aria-label="닫기"
            onClick={onClose}
            className="tap text-muted-foreground"
          >
            ✕
          </button>
        </header>

        <div className="space-y-md">
          <p className="text-body-sm text-muted-foreground">
            비활성화를 확인하기 위해 현재 Authenticator 앱의 6자리 코드를 입력하세요.
          </p>
          <TotpField
            value={code}
            onChange={setCode}
            onComplete={(c) => submit(c)}
            autoFocus
            disabled={loading}
          />
          {err && <p role="alert" className="text-body-sm text-status-error">{err}</p>}
          <Button
            variant="destructive"
            size="lg"
            block
            loading={loading}
            disabled={code.length !== 6}
            onClick={() => submit()}
          >
            비활성화
          </Button>
        </div>
      </div>
    </div>
  );
}
