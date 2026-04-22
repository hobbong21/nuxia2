'use client';

/**
 * /mypage/security — 2단계 인증 설정 페이지.
 *
 * v0.4 M5-FE-1.
 *
 * 상태 카드:
 *  - 2FA 비활성 → "2단계 인증 설정" 버튼 → TotpSetupModal
 *  - 2FA 활성   → "설정 완료 • YYYY-MM-DD부터" + "비활성화" 버튼 → TotpDisableModal
 */
import * as React from 'react';
import { Header } from '@/components/commerce/Header';
import { Button } from '@/components/ui/button';
import { TotpSetupModal } from '@/components/auth/TotpSetupModal';
import { TotpDisableModal } from '@/components/auth/TotpDisableModal';
import { authApi } from '@/lib/auth-client';

function formatDate(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return '';
  }
}

export default function SecurityPage() {
  const [status, setStatus] = React.useState<{ enabled: boolean; enabledAt: string | null } | null>(null);
  const [openSetup, setOpenSetup] = React.useState(false);
  const [openDisable, setOpenDisable] = React.useState(false);

  const refresh = React.useCallback(async () => {
    const s = await authApi.get2FAStatus();
    setStatus(s);
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const enabled = !!status?.enabled;
  const dateLabel = formatDate(status?.enabledAt ?? null);

  return (
    <>
      <Header title="보안" showBack />
      <main className="px-base pt-lg pb-base">
        <section className="max-w-md mx-auto space-y-md">
          <header className="space-y-xs">
            <h2 className="text-h3">2단계 인증</h2>
            <p className="text-body-sm text-muted-foreground">
              Authenticator 앱의 6자리 코드로 로그인을 보호합니다.
            </p>
          </header>

          {status === null ? (
            <div
              aria-busy="true"
              className="rounded-card border border-border bg-background p-base text-body-sm text-muted-foreground"
            >
              상태 확인 중…
            </div>
          ) : enabled ? (
            <div
              role="status"
              className="rounded-card border border-border bg-background p-base space-y-sm"
              data-testid="totp-status-enabled"
            >
              <div className="flex items-center gap-xs">
                <span aria-hidden className="text-status-success">●</span>
                <span className="text-body font-semibold">활성화됨</span>
              </div>
              <p className="text-body-sm text-muted-foreground">
                {dateLabel ? `설정 완료 • ${dateLabel}부터` : '설정 완료'}
              </p>
              <Button
                variant="destructive"
                size="md"
                onClick={() => setOpenDisable(true)}
              >
                비활성화
              </Button>
            </div>
          ) : (
            <div
              role="status"
              className="rounded-card border border-border bg-background p-base space-y-sm"
              data-testid="totp-status-disabled"
            >
              <div className="flex items-center gap-xs">
                <span aria-hidden className="text-status-warning">●</span>
                <span className="text-body font-semibold">비활성화</span>
              </div>
              <p className="text-body-sm text-muted-foreground">
                2단계 인증을 활성화하면 계정이 더욱 안전하게 보호됩니다.
              </p>
              <Button
                variant="accent"
                size="md"
                onClick={() => setOpenSetup(true)}
              >
                2단계 인증 설정
              </Button>
            </div>
          )}
        </section>
      </main>

      <TotpSetupModal
        open={openSetup}
        onClose={() => setOpenSetup(false)}
        onEnabled={() => { setOpenSetup(false); refresh(); }}
      />
      <TotpDisableModal
        open={openDisable}
        onClose={() => setOpenDisable(false)}
        onDisabled={() => refresh()}
      />
    </>
  );
}
