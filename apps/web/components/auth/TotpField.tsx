'use client';

/**
 * TotpField — 6자리 TOTP 입력 컴포넌트.
 *
 * 지원:
 *  - 한 칸당 하나의 숫자 (접근성: aria-label, autoFocus 이동)
 *  - 붙여넣기 (6자리 자동 분배)
 *  - 6자리 완성 시 `onComplete` 자동 호출
 *  - 백스페이스로 이전 칸 포커스 이동
 */
import * as React from 'react';
import { cn } from '@/lib/utils';

const LEN = 6;

export interface TotpFieldProps {
  value: string;
  onChange: (next: string) => void;
  /** 6자리 입력 완료 시 자동 호출 */
  onComplete?: (code: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  /** 접근성: 필드 그룹 라벨 */
  ariaLabel?: string;
}

export function TotpField({
  value,
  onChange,
  onComplete,
  disabled,
  autoFocus,
  ariaLabel = '인증번호 6자리',
}: TotpFieldProps) {
  const refs = React.useRef<Array<HTMLInputElement | null>>([]);
  const digits = React.useMemo(() => {
    const padded = (value || '').replace(/\D/g, '').slice(0, LEN);
    return Array.from({ length: LEN }, (_, i) => padded[i] ?? '');
  }, [value]);

  // 자동 제출 — 6자리 완성 시 1회 호출
  const completedRef = React.useRef(false);
  React.useEffect(() => {
    const joined = digits.join('');
    if (joined.length === LEN && !completedRef.current && !disabled) {
      completedRef.current = true;
      onComplete?.(joined);
    }
    if (joined.length < LEN) {
      completedRef.current = false;
    }
  }, [digits, onComplete, disabled]);

  React.useEffect(() => {
    if (autoFocus) {
      refs.current[0]?.focus();
    }
  }, [autoFocus]);

  const setDigit = (idx: number, d: string) => {
    const next = digits.slice();
    next[idx] = d;
    onChange(next.join(''));
  };

  const onKeyDown = (idx: number) => (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[idx] && idx > 0) {
      refs.current[idx - 1]?.focus();
      setDigit(idx - 1, '');
      e.preventDefault();
    }
    if (e.key === 'ArrowLeft' && idx > 0) {
      refs.current[idx - 1]?.focus();
      e.preventDefault();
    }
    if (e.key === 'ArrowRight' && idx < LEN - 1) {
      refs.current[idx + 1]?.focus();
      e.preventDefault();
    }
  };

  const onChangeInput = (idx: number) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '');
    if (!raw) {
      setDigit(idx, '');
      return;
    }
    // 한 글자 이상 입력된 경우(자동완성 등) 여러 칸에 분배
    if (raw.length > 1) {
      const chars = raw.slice(0, LEN - idx).split('');
      const next = digits.slice();
      chars.forEach((c, i) => { next[idx + i] = c; });
      onChange(next.join(''));
      const focusTarget = Math.min(idx + chars.length, LEN - 1);
      refs.current[focusTarget]?.focus();
      return;
    }
    setDigit(idx, raw);
    if (idx < LEN - 1) refs.current[idx + 1]?.focus();
  };

  const onPaste = (idx: number) => (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, LEN);
    if (!pasted) return;
    e.preventDefault();
    const next = Array.from({ length: LEN }, (_, i) => (i < idx ? digits[i] : pasted[i - idx] ?? ''));
    onChange(next.join(''));
    const nextFocus = Math.min(idx + pasted.length, LEN - 1);
    refs.current[nextFocus]?.focus();
  };

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="flex items-center justify-between gap-xs"
    >
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          pattern="[0-9]*"
          maxLength={1}
          value={d}
          disabled={disabled}
          aria-label={`인증번호 ${i + 1}번째 자리`}
          onChange={onChangeInput(i)}
          onKeyDown={onKeyDown(i)}
          onPaste={onPaste(i)}
          onFocus={(e) => e.target.select()}
          className={cn(
            'h-12 w-12 rounded-button border border-border bg-input text-center text-lead font-mono tabular-nums',
            'focus-visible:border-ring focus-visible:bg-background focus-visible:outline-none',
            'disabled:opacity-40 disabled:cursor-not-allowed',
          )}
        />
      ))}
    </div>
  );
}
