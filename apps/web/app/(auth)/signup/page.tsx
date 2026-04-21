'use client';

import * as React from 'react';
import { Header } from '@/components/commerce/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { requestIdentityVerification } from '@/lib/portone';
import { getPendingReferralCode } from '@/lib/native';

export default function SignupPage() {
  const toast = useToast();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [nickname, setNickname] = React.useState('');
  const [referralCode, setReferralCode] = React.useState('');
  const [ivId, setIvId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  // 딥링크/URL에서 들어온 추천 코드 자동 주입
  React.useEffect(() => {
    (async () => {
      const params = new URLSearchParams(window.location.search);
      const fromQuery = params.get('ref');
      const fromStore = await getPendingReferralCode();
      if (fromQuery) setReferralCode(fromQuery);
      else if (fromStore) setReferralCode(fromStore);
    })();
  }, []);

  const onVerify = async () => {
    try {
      const res = await requestIdentityVerification({ userId: `guest_${Date.now()}` });
      if (res.code) {
        toast.show(`본인인증 실패: ${res.message ?? res.code}`, 'error');
        return;
      }
      setIvId(res.identityVerificationId);
      toast.show('본인인증이 완료되었습니다', 'success');
    } catch {
      toast.show('본인인증 중 오류', 'error');
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ivId) {
      toast.show('본인인증을 먼저 완료해 주세요', 'warning');
      return;
    }
    setLoading(true);
    try {
      // TODO: api.post('/auth/signup', { email, password, nickname, identityVerificationId: ivId, referralCode }, AuthResponseSchema)
      await new Promise((r) => setTimeout(r, 500));
      toast.show('가입이 완료되었습니다', 'success');
    } catch {
      toast.show('가입에 실패했습니다', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Header title="회원가입" showBack />
      <main className="px-base pt-lg pb-base">
        <form onSubmit={onSubmit} className="space-y-md max-w-md mx-auto">
          <label className="block space-y-xs">
            <span className="text-body-sm text-muted-foreground">이메일</span>
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="block space-y-xs">
            <span className="text-body-sm text-muted-foreground">비밀번호 (8자 이상)</span>
            <Input
              type="password"
              minLength={8}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <label className="block space-y-xs">
            <span className="text-body-sm text-muted-foreground">닉네임</span>
            <Input
              type="text"
              maxLength={40}
              required
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
            />
          </label>

          <div className="space-y-xs">
            <span className="text-body-sm text-muted-foreground">본인인증</span>
            <Button
              type="button"
              variant={ivId ? 'secondary' : 'primary'}
              size="lg"
              block
              onClick={onVerify}
            >
              {ivId ? '✓ 인증 완료' : '포트원 본인인증'}
            </Button>
            <p className="text-caption text-muted-foreground">
              본인인증은 주문·레퍼럴 수익 수취를 위해 필수입니다
            </p>
          </div>

          <label className="block space-y-xs">
            <span className="text-body-sm text-muted-foreground">추천인 코드 (선택)</span>
            <Input
              type="text"
              placeholder="NX-ABC123"
              value={referralCode}
              onChange={(e) => setReferralCode(e.target.value)}
            />
            {referralCode && (
              <p className="text-caption text-accent">
                친구가 초대한 코드가 자동 주입되었습니다
              </p>
            )}
          </label>

          <Button type="submit" variant="accent" size="lg" block loading={loading}>
            가입하기
          </Button>
          <p className="text-caption text-muted-foreground">
            가입 시 이용약관 및 개인정보처리방침에 동의하는 것으로 간주합니다.
            셀프레퍼럴(동일 본인인증 정보) 및 임직원은 레퍼럴 참여가 불가합니다.
          </p>
        </form>
      </main>
    </>
  );
}
