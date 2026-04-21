/**
 * Serialization helpers — convert Prisma rows to JSON-safe shapes that match
 * `@nuxia/shared-types` zod schemas.
 *
 * Rules:
 *  - All BigInt fields → decimal string
 *  - All Date fields → ISO 8601 string
 *  - Sensitive fields stripped (passwordHash / ci / ciHash / phoneNumber)
 *  - `identityVerified` / `age` computed from ciHash / dateOfBirth
 */

/** Compute integer age (만 나이) from a date-of-birth. Returns null if dob null. */
export function calcAge(dob: Date | null | undefined): number | null {
  if (!dob) return null
  const now = new Date()
  let age = now.getFullYear() - dob.getFullYear()
  const mBefore =
    now.getMonth() < dob.getMonth() ||
    (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate())
  if (mBefore) age -= 1
  if (age < 0 || age > 150) return null
  return age
}

/** Convert a Prisma User row into the shared-types User DTO. */
export function serializeUser(u: any) {
  return {
    id: u.id,
    email: u.email,
    nickname: u.nickname,
    referralCode: u.referralCode,
    referrerId: u.referrerId ?? null,
    ancestorPath: u.ancestorPath ?? [],
    role: u.role,
    status: u.status,
    identityVerified: !!u.ciHash,
    payoutEligibility: !!u.payoutEligibility,
    age: calcAge(u.dateOfBirth ?? null),
    createdAt: u.createdAt?.toISOString?.() ?? u.createdAt,
    updatedAt: u.updatedAt?.toISOString?.() ?? u.updatedAt,
  }
}

/** BigInt → decimal string (null-safe). */
export function bi(v: bigint | null | undefined, fallback = '0'): string {
  if (v == null) return fallback
  return v.toString()
}

/** Date → ISO string (null-safe). */
export function iso(d: Date | null | undefined): string | null {
  if (!d) return null
  return d instanceof Date ? d.toISOString() : String(d)
}
