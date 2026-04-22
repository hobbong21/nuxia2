'use client';

import * as React from 'react';
import { ShippingAddressSchema, type ShippingAddress } from '@nuxia2/shared-types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface ShippingAddressFormProps {
  /** 초기값 (수정 모드 or 저장된 배송지 불러오기) */
  initialValue?: ShippingAddress | null;
  /** 유효성 통과 후 부모에게 전달 */
  onValidChange?: (addr: ShippingAddress | null) => void;
  /** 제출 버튼 표시 여부. false면 `onValidChange` 만으로 상위에서 제어 */
  showSubmit?: boolean;
  /** 제출 버튼 클릭 — 검증 통과 시 호출 */
  onSubmit?: (addr: ShippingAddress) => void;
  className?: string;
}

type FormState = {
  recipientName: string;
  phone: string;
  zipCode: string;
  address1: string;
  address2: string;
  memo: string;
};

type FormErrors = Partial<Record<keyof FormState, string>>;

const EMPTY: FormState = {
  recipientName: '',
  phone: '',
  zipCode: '',
  address1: '',
  address2: '',
  memo: '',
};

/**
 * designer_spec §5-5 체크아웃 — 배송지 입력 폼.
 * - shared-types ShippingAddressSchema 와 1:1 매핑
 * - 모바일 1열 / md 이상 2열 grid
 * - 제출 시 zod 검증
 * - "주소 검색" 버튼은 v0.4 다음/카카오 API 연동 전까지 수동 입력 허용
 */
export function ShippingAddressForm({
  initialValue,
  onValidChange,
  showSubmit = true,
  onSubmit,
  className,
}: ShippingAddressFormProps) {
  const [values, setValues] = React.useState<FormState>(() =>
    initialValue
      ? {
          recipientName: initialValue.recipientName,
          phone: initialValue.phone,
          zipCode: initialValue.zipCode,
          address1: initialValue.address1,
          address2: initialValue.address2 ?? '',
          memo: initialValue.memo ?? '',
        }
      : EMPTY,
  );
  const [errors, setErrors] = React.useState<FormErrors>({});
  const [showSearchNotice, setShowSearchNotice] = React.useState(false);

  const set = React.useCallback(
    <K extends keyof FormState>(key: K, v: string) => {
      setValues((prev) => ({ ...prev, [key]: v }));
    },
    [],
  );

  /** 현재 값의 zod parse 결과 (제출 아니어도 실시간 onValidChange 전달용) */
  const parseCurrent = React.useCallback((): ShippingAddress | null => {
    const r = ShippingAddressSchema.safeParse({
      recipientName: values.recipientName.trim(),
      phone: values.phone.trim(),
      zipCode: values.zipCode.trim(),
      address1: values.address1.trim(),
      address2: values.address2.trim(),
      memo: values.memo.trim() || undefined,
    });
    return r.success ? r.data : null;
  }, [values]);

  React.useEffect(() => {
    if (!onValidChange) return;
    onValidChange(parseCurrent());
  }, [parseCurrent, onValidChange]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = ShippingAddressSchema.safeParse({
      recipientName: values.recipientName.trim(),
      phone: values.phone.trim(),
      zipCode: values.zipCode.trim(),
      address1: values.address1.trim(),
      address2: values.address2.trim(),
      memo: values.memo.trim() || undefined,
    });
    if (!result.success) {
      const flat = result.error.flatten().fieldErrors;
      const newErrors: FormErrors = {};
      (Object.keys(flat) as (keyof FormState)[]).forEach((k) => {
        const msg = flat[k]?.[0];
        if (msg) newErrors[k] = friendly(k, msg);
      });
      setErrors(newErrors);
      return;
    }
    setErrors({});
    onSubmit?.(result.data);
  };

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className={cn('space-y-base', className)}
    >
      <div className="grid grid-cols-1 gap-base md:grid-cols-2">
        <Field
          label="수취인 이름"
          required
          htmlFor="ship-name"
          error={errors.recipientName}
        >
          <Input
            id="ship-name"
            autoComplete="name"
            value={values.recipientName}
            onChange={(e) => set('recipientName', e.target.value)}
            aria-invalid={!!errors.recipientName}
            aria-describedby={errors.recipientName ? 'ship-name-err' : undefined}
          />
        </Field>

        <Field
          label="휴대폰 번호"
          required
          htmlFor="ship-phone"
          error={errors.phone}
        >
          <Input
            id="ship-phone"
            type="tel"
            autoComplete="tel"
            placeholder="010-1234-5678"
            value={values.phone}
            onChange={(e) => set('phone', e.target.value)}
            aria-invalid={!!errors.phone}
            aria-describedby={errors.phone ? 'ship-phone-err' : undefined}
          />
        </Field>

        <Field
          label="우편번호"
          required
          htmlFor="ship-zip"
          error={errors.zipCode}
          className="md:col-span-2"
        >
          <div className="flex items-stretch gap-sm">
            <Input
              id="ship-zip"
              inputMode="numeric"
              autoComplete="postal-code"
              placeholder="12345"
              value={values.zipCode}
              onChange={(e) => set('zipCode', e.target.value)}
              aria-invalid={!!errors.zipCode}
              aria-describedby={errors.zipCode ? 'ship-zip-err' : undefined}
              className="flex-1"
            />
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={() => setShowSearchNotice(true)}
              aria-label="우편번호 검색 (준비 중)"
            >
              주소 검색
            </Button>
          </div>
          {showSearchNotice && (
            <p
              role="note"
              className="mt-xs text-caption text-muted-foreground"
            >
              TODO: 다음/카카오 주소검색 연동은 v0.4 — 그동안은 수동 입력해 주세요.
            </p>
          )}
        </Field>

        <Field
          label="도로명 주소"
          required
          htmlFor="ship-addr1"
          error={errors.address1}
          className="md:col-span-2"
        >
          <Input
            id="ship-addr1"
            autoComplete="address-line1"
            placeholder="서울특별시 종로구 세종대로 1"
            value={values.address1}
            onChange={(e) => set('address1', e.target.value)}
            aria-invalid={!!errors.address1}
            aria-describedby={errors.address1 ? 'ship-addr1-err' : undefined}
          />
        </Field>

        <Field
          label="상세 주소"
          htmlFor="ship-addr2"
          error={errors.address2}
          className="md:col-span-2"
        >
          <Input
            id="ship-addr2"
            autoComplete="address-line2"
            placeholder="101동 1004호"
            value={values.address2}
            onChange={(e) => set('address2', e.target.value)}
          />
        </Field>

        <Field
          label="배송 메모 (선택)"
          htmlFor="ship-memo"
          className="md:col-span-2"
        >
          <Input
            id="ship-memo"
            placeholder="경비실에 맡겨주세요"
            value={values.memo}
            onChange={(e) => set('memo', e.target.value)}
          />
        </Field>
      </div>

      {showSubmit && (
        <Button type="submit" variant="primary" size="lg" block>
          배송지 저장
        </Button>
      )}
    </form>
  );
}

function Field({
  label,
  required,
  htmlFor,
  error,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  htmlFor: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('space-y-xs', className)}>
      <label htmlFor={htmlFor} className="block text-body-sm font-medium">
        {label}
        {required && (
          <span aria-hidden className="ml-1 text-status-error">
            *
          </span>
        )}
      </label>
      {children}
      {error && (
        <p
          id={`${htmlFor}-err`}
          role="alert"
          className="text-caption text-status-error"
        >
          {error}
        </p>
      )}
    </div>
  );
}

function friendly(key: keyof FormState, _msg: string): string {
  switch (key) {
    case 'recipientName':
      return '수취인 이름을 입력해 주세요';
    case 'phone':
      return '휴대폰 번호를 입력해 주세요';
    case 'zipCode':
      return '우편번호를 입력해 주세요';
    case 'address1':
      return '도로명 주소를 입력해 주세요';
    case 'address2':
      return '상세 주소를 확인해 주세요';
    default:
      return '입력값을 확인해 주세요';
  }
}
