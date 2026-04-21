/**
 * Integer-KRW (원 단위) utilities. All amounts are BigInt.
 * 반올림 규칙: floor (내림). 절삭 잔액은 플랫폼 귀속.
 */
export function floorBps(amount: bigint, bps: number): bigint {
  if (bps < 0) throw new Error('bps must be >= 0')
  return (amount * BigInt(bps)) / 10_000n
}

export function floorRatio(amount: bigint, ratioBps: number): bigint {
  return floorBps(amount, ratioBps)
}

// Apply withholding: net = gross - floor(gross * withholdingBps / 10000)
export function applyWithholding(
  gross: bigint,
  withholdingBps: number,
): { gross: bigint; tax: bigint; net: bigint } {
  const tax = floorBps(gross, withholdingBps)
  return { gross, tax, net: gross - tax }
}
