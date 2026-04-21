'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { shareReferralLink } from '@/lib/native';
import { cn } from '@/lib/utils';

export interface InviteCodeShareProps {
  referralCode: string;
  className?: string;
}

export function InviteCodeShare({ referralCode, className }: InviteCodeShareProps) {
  const toast = useToast();
  const url = `https://nuxia2.app/r/${referralCode}`;

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(referralCode);
      toast.show('초대 코드가 복사되었습니다', 'success');
    } catch {
      toast.show('복사에 실패했습니다', 'error');
    }
  };

  const onShare = async () => {
    const res = await shareReferralLink({ code: referralCode, url });
    if (res.shared && res.fallback === 'clipboard') {
      toast.show('링크가 복사되었습니다', 'success');
    } else if (!res.shared) {
      toast.show('공유에 실패했습니다', 'error');
    }
  };

  return (
    <section
      aria-label="초대 코드"
      className={cn(
        'rounded-card border border-border bg-background p-base space-y-sm',
        className,
      )}
    >
      <p className="text-caption text-muted-foreground">내 초대 코드</p>
      <div className="flex items-center gap-sm">
        <code
          className="flex-1 rounded-sm bg-muted px-md py-sm font-mono text-h4 tracking-wider"
          aria-label={`엔엑스 ${referralCode.replace(/-/g, ' ').split('').join(' ')}`}
        >
          {referralCode}
        </code>
        <Button
          variant="secondary"
          size="lg"
          onClick={onCopy}
          aria-label="초대 코드 복사"
        >
          복사
        </Button>
      </div>
      <div className="flex gap-sm">
        <Button variant="accent" size="lg" block onClick={onShare}>
          초대 링크 공유
        </Button>
      </div>
      <p className="text-caption text-muted-foreground">
        링크로 가입한 친구의 주문에서 1대 3% 수익이 발생합니다
      </p>
    </section>
  );
}
