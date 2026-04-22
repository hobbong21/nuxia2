'use client';

/**
 * OtpChannelPicker — v0.5 M3-FE.
 *
 * 로그인 2단계에서 TOTP 앱 / SMS / 이메일 중 선택하는 segmented control.
 *  - 값 `TOTP` 는 "앱 인증번호" (기본)
 *  - 값 `SMS` 는 사용자 전화번호가 등록된 경우에만 노출
 *  - 값 `EMAIL` 은 항상 노출 (가입 시 이메일 필수)
 *
 * 선택 시 상위 콜백으로 채널 전달. 모바일 44px 터치타겟, aria-pressed로 상태 노출.
 */
import * as React from 'react';
import { cn } from '@/lib/utils';

export type OtpChannelChoice = 'TOTP' | 'SMS' | 'EMAIL';

export interface OtpChannelPickerProps {
  value: OtpChannelChoice;
  onChange: (next: OtpChannelChoice) => void;
  /** 전화번호 등록 여부. false면 SMS 탭 비노출 */
  hasPhone?: boolean;
  /** 이메일 등록 여부. 기본 true(가입 시 필수). */
  hasEmail?: boolean;
  disabled?: boolean;
  className?: string;
}

interface Option {
  value: OtpChannelChoice;
  label: string;
  hint: string;
  icon: string;
}

export function OtpChannelPicker({
  value,
  onChange,
  hasPhone = false,
  hasEmail = true,
  disabled,
  className,
}: OtpChannelPickerProps) {
  const options = React.useMemo<Option[]>(() => {
    const list: Option[] = [
      { value: 'TOTP', label: '앱 인증번호', hint: 'Authenticator', icon: '🔑' },
    ];
    if (hasPhone) list.push({ value: 'SMS', label: 'SMS로 받기', hint: '등록된 휴대폰', icon: '📱' });
    if (hasEmail) list.push({ value: 'EMAIL', label: '이메일로 받기', hint: '가입 이메일', icon: '✉' });
    return list;
  }, [hasPhone, hasEmail]);

  return (
    <div
      role="radiogroup"
      aria-label="인증 수단 선택"
      className={cn(
        'grid gap-xs',
        options.length === 1
          ? 'grid-cols-1'
          : options.length === 2
            ? 'grid-cols-2'
            : 'grid-cols-3',
        className,
      )}
    >
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-pressed={active}
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={cn(
              'flex min-h-[44px] flex-col items-center justify-center gap-0.5 rounded-button border px-sm py-xs text-body-sm transition-colors',
              active
                ? 'border-accent bg-accent/15 text-white'
                : 'border-border bg-background text-muted-foreground hover:border-zinc-500 hover:text-white',
              'disabled:cursor-not-allowed disabled:opacity-40',
            )}
          >
            <span className="flex items-center gap-1">
              <span aria-hidden>{opt.icon}</span>
              <span className="font-semibold">{opt.label}</span>
            </span>
            <span className="text-caption text-muted-foreground">{opt.hint}</span>
          </button>
        );
      })}
    </div>
  );
}
