import { Injectable, Logger } from '@nestjs/common'

/**
 * PortOne V2 identity-verification lookup.
 *
 * QA P0-01: 프론트는 `identityVerificationId` 만 전달한다. 서버가 포트원에
 * 재조회하여 `ci` 를 포함한 원문을 받아온다. `ci` 는 절대 프론트로 내려가지
 * 않는다 — `crypto.util.ts::encryptCi` 로 암호화 저장만 한다.
 *
 * Production: `@portone/server-sdk` 의 `identityVerification.get` 를 사용.
 * 이 shim 은 REST API 를 직접 호출하여 SDK 버전 독립성을 유지한다.
 */

export interface PortOneIdentityVerification {
  id: string
  status: 'READY' | 'VERIFIED' | 'FAILED'
  verifiedCustomer?: {
    /** 연계정보 CI (plaintext — 서버 내부에서만 통용) */
    ci: string
    name?: string
    phoneNumber?: string
    birthDate?: string // 'YYYY-MM-DD'
    gender?: 'MALE' | 'FEMALE' | null
  }
  failedReason?: string
}

@Injectable()
export class IdentityVerificationClient {
  private readonly logger = new Logger('IdentityVerificationClient')
  private readonly apiSecret = process.env.PORTONE_API_SECRET ?? ''

  async get(identityVerificationId: string): Promise<PortOneIdentityVerification> {
    const url = `https://api.portone.io/identity-verifications/${encodeURIComponent(
      identityVerificationId,
    )}`
    const res = await fetch(url, {
      headers: { Authorization: `PortOne ${this.apiSecret}` },
    })
    if (!res.ok) {
      throw new Error(`PortOne identity-verification get failed: ${res.status}`)
    }
    return (await res.json()) as PortOneIdentityVerification
  }
}
