'use client';

/**
 * TotpSetupModal — 2FA 설정 모달 (3 steps).
 *
 * Step 1: POST /auth/2fa/setup 호출 → QR 데이터 URI 표시
 * Step 2: Authenticator 앱에서 코드 입력 (6자리)
 * Step 3: POST /auth/2fa/verify → 성공 시 모달 닫힘 + 토스트
 */
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { authApi, AuthClientError } from '@/lib/auth-client';
import { TotpField } from './TotpField';

export interface TotpSetupModalProps {
  open: boolean;
  onClose: () => void;
  onEnabled: () => void;
}

type Step = 'intro' | 'qr' | 'verify' | 'done';

export function TotpSetupModal({ open, onClose, onEnabled }: TotpSetupModalProps) {
  const toast = useToast();
  const [step, setStep] = React.useState<Step>('intro');
  const [qr, setQr] = React.useState<string | null>(null);
  const [secret, setSecret] = React.useState<string | null>(null);
  const [code, setCode] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) {
      // 닫힐 때 상태 초기화
      setStep('intro');
      setQr(null);
      setSecret(null);
      setCode('');
      setErr(null);
      setLoading(false);
    }
  }, [open]);

  const startSetup = async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await authApi.setup2FA();
      setQr(res.qrDataUri);
      setSecret(res.secret ?? null);
      setStep('qr');
    } catch (e) {
      setErr(e instanceof AuthClientError ? e.message : '설정 시작에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const submitVerify = async (explicit?: string) => {
    const c = (explicit ?? code).replace(/\D/g, '');
    if (c.length !== 6) return;
    setLoading(true);
    setErr(null);
    try {
      await authApi.verify2FA(c);
      setStep('done');
      toast.show('2단계 인증이 활성화되었습니다.', 'success');
      onEnabled();
    } catch (e) {
      setErr(e instanceof AuthClientError ? e.message : '코드 확인에 실패했습니다. 다시 시도해 주세요.');
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
      aria-labelledby="totp-setup-title"
      className="fixed inset-0 z-modal flex items-center justify-center bg-black/60 px-base"
    >
      <div className="w-full max-w-md rounded-card bg-background p-lg shadow-elevated">
        <header className="mb-base flex items-center justify-between">
          <h2 id="totp-setup-title" className="text-h4">2단계 인증 설정</h2>
          <button
            type="button"
            aria-label="닫기"
            onClick={onClose}
            className="tap text-muted-foreground"
          >
            ✕
          </button>
        </header>

        {step === 'intro' && (
          <div className="space-y-md">
            <p className="text-body-sm text-muted-foreground">
              로그인 시 비밀번호와 함께 Authenticator 앱의 6자리 코드를 요구합니다.
              Google Authenticator, 1Password, Authy 등 대부분의 TOTP 앱이 호환됩니다.
            </p>
            <Button variant="accent" size="lg" block loading={loading} onClick={startSetup}>
              시작하기
            </Button>
            {err && <p role="alert" className="text-body-sm text-status-error">{err}</p>}
          </div>
        )}

        {step === 'qr' && qr && (
          <div className="space-y-md">
            <p className="text-body-sm text-muted-foreground">
              Authenticator 앱으로 아래 QR 코드를 스캔하세요.
            </p>
            <div className="flex items-center justify-center rounded-card border border-border bg-white p-base">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt="TOTP QR 코드" className="h-44 w-44" />
            </div>
            {secret && (
              <details className="text-body-sm text-muted-foreground">
                <summary className="cursor-pointer">QR 스캔이 불가능한 경우</summary>
                <p className="mt-xs font-mono break-all">{secret}</p>
              </details>
            )}
            <Button variant="accent" size="lg" block onClick={() => setStep('verify')}>
              다음
            </Button>
          </div>
        )}

        {step === 'verify' && (
          <div className="space-y-md">
            <p className="text-body-sm text-muted-foreground">
              앱에 표시된 6자리 인증번호를 입력하세요.
            </p>
            <TotpField
              value={code}
              onChange={setCode}
              onComplete={(c) => submitVerify(c)}
              autoFocus
              disabled={loading}
            />
            {err && <p role="alert" className="text-body-sm text-status-error">{err}</p>}
            <Button
              variant="accent"
              size="lg"
              block
              loading={loading}
              disabled={code.length !== 6}
              onClick={() => submitVerify()}
            >
              확인
            </Button>
          </div>
        )}

        {step === 'done' && (
          <div className="space-y-md">
            <p className="text-body text-status-success">2단계 인증이 활성화되었습니다.</p>
            <Button variant="primary" size="lg" block onClick={onClose}>
              닫기
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
