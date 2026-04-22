'use client';

/**
 * 로그인 페이지 — v0.4 M5-FE-2 / S2.
 *
 * 1단계: email + password → POST /auth/login
 *   응답이 { needsTotp: true, userId } 면 2단계로 전환
 *   응답이 AuthResponse 면 토큰 저장 후 홈 이동
 *
 * 2단계: 6자리 코드 → POST /auth/2fa/login { userId, code } → AuthResponse
 */
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/commerce/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TotpField } from '@/components/auth/TotpField';
import { useToast } from '@/components/ui/toast';
import { authApi, AuthClientError } from '@/lib/auth-client';
import type { AuthResponse } from '@nuxia2/shared-types';

type Stage =
  | { kind: 'creds' }
  | { kind: 'totp'; userId: string };

export default function LoginPage() {
  const router = useRouter();
  const toast = useToast();

  const [stage, setStage] = React.useState<Stage>({ kind: 'creds' });
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [code, setCode] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const handleAuthSuccess = (_res: AuthResponse) => {
    // TODO(v0.4-sync): access/refresh token 저장 — auth store (zustand) 도입 시 _res.accessToken 사용.
    // 쿠키(nx_role) 는 BE가 Set-Cookie 로 내려주므로 여기선 이동만.
    toast.show('로그인되었습니다.', 'success');
    router.push('/');
    router.refresh();
  };

  const onSubmitCreds = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    try {
      const res = await authApi.login(email, password);
      if ('needsTotp' in res) {
        setStage({ kind: 'totp', userId: res.userId });
        setCode('');
      } else {
        handleAuthSuccess(res);
      }
    } catch (e) {
      setErr(e instanceof AuthClientError ? e.message : '로그인에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const submitTotp = async (explicit?: string) => {
    if (stage.kind !== 'totp') return;
    const c = (explicit ?? code).replace(/\D/g, '');
    if (c.length !== 6) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await authApi.login2FA(stage.userId, c);
      handleAuthSuccess(res);
    } catch (e) {
      setErr(e instanceof AuthClientError ? e.message : '코드 확인에 실패했습니다.');
      setCode('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Header title="로그인" showBack />
      <main className="px-base pt-lg pb-base">
        {stage.kind === 'creds' ? (
          <form onSubmit={onSubmitCreds} className="space-y-md max-w-md mx-auto">
            <label className="block space-y-xs">
              <span className="text-body-sm text-muted-foreground">이메일</span>
              <Input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </label>
            <label className="block space-y-xs">
              <span className="text-body-sm text-muted-foreground">비밀번호</span>
              <Input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </label>
            {err && <p role="alert" className="text-body-sm text-status-error">{err}</p>}
            <Button type="submit" variant="accent" size="lg" block loading={loading}>
              로그인
            </Button>
            <div className="flex items-center justify-between pt-sm text-body-sm">
              <Link href="/signup" className="text-accent">회원가입</Link>
              <Link href="/forgot" className="text-muted-foreground">비밀번호 찾기</Link>
            </div>
          </form>
        ) : (
          <form
            onSubmit={(e) => { e.preventDefault(); submitTotp(); }}
            className="space-y-md max-w-md mx-auto"
            aria-labelledby="totp-step-title"
          >
            <header className="space-y-xs">
              <h2 id="totp-step-title" className="text-h4">2단계 인증</h2>
              <p className="text-body-sm text-muted-foreground">
                Authenticator 앱의 6자리 코드를 입력하세요.
              </p>
            </header>
            <TotpField
              value={code}
              onChange={setCode}
              onComplete={(c) => submitTotp(c)}
              autoFocus
              disabled={loading}
            />
            {err && <p role="alert" className="text-body-sm text-status-error">{err}</p>}
            <Button
              type="submit"
              variant="accent"
              size="lg"
              block
              loading={loading}
              disabled={code.length !== 6}
            >
              확인
            </Button>
            <button
              type="button"
              onClick={() => { setStage({ kind: 'creds' }); setCode(''); setErr(null); }}
              className="block w-full text-body-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              다른 계정으로 로그인
            </button>
          </form>
        )}
      </main>
    </>
  );
}
