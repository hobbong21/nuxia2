/**
 * KRW·BigIntString 포맷 유틸.
 * - 금액은 BigIntString (packages/shared-types/common.ts)을 1차 시민으로 사용.
 * - Number 변환은 표시용에 한정 (Number.MAX_SAFE_INTEGER = 9.007천조 > KRW 운영범위).
 */

const krwFormatter = new Intl.NumberFormat('ko-KR');

export function formatKrw(value: string | number | bigint): string {
  if (typeof value === 'string') {
    // BigIntString은 내부에 천단위 컴마 없음. 정규식 검증.
    if (!/^-?\d+$/.test(value)) return value;
    try {
      return `${krwFormatter.format(BigInt(value))}원`;
    } catch {
      return `${value}원`;
    }
  }
  return `${krwFormatter.format(value)}원`;
}

/** 원 단위. "원" 미붙임 */
export function formatKrwNumber(value: string | number | bigint): string {
  if (typeof value === 'string') {
    try {
      return krwFormatter.format(BigInt(value));
    } catch {
      return value;
    }
  }
  return krwFormatter.format(value);
}

/** 할인율 (0~100 정수) 표시 */
export function formatDiscountPct(pct: number): string {
  return `-${Math.round(pct)}%`;
}

/** bps → % 문자열. 300 → "3%", 1700 → "17%" */
export function bpsToPercent(bps: number): string {
  return `${bps / 100}%`;
}

/** 날짜: YYYY-MM-DD KST */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** BigIntString 덧셈 (간이 보조) */
export function addBigIntString(a: string, b: string): string {
  return (BigInt(a) + BigInt(b)).toString();
}

/** 공유용 소셜 텍스트 */
export function shareLabel(code: string): string {
  return `Nuxia 초대 코드 ${code} — 첫 구매 시 적립 혜택`;
}
