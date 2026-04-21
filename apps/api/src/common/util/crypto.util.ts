import { createCipheriv, createDecipheriv, createHmac, randomBytes, createHash } from 'crypto'

/**
 * App-level AES-256-GCM encryption for PII (ci, bank account number, phone).
 *
 * Production: replace `getMasterKey()` with a KMS client (AWS KMS / GCP KMS)
 * that decrypts a per-env DEK. The rest of the module stays the same.
 */

const ALG = 'aes-256-gcm'

function getMasterKey(): Buffer {
  const hex = process.env.APP_ENCRYPTION_KEY
  if (!hex || hex.length !== 64) {
    throw new Error('APP_ENCRYPTION_KEY must be a 32-byte hex string (64 chars)')
  }
  return Buffer.from(hex, 'hex')
}

function getSalt(): string {
  return process.env.APP_ENCRYPTION_SALT ?? 'nuxia-default-salt'
}

export interface EncryptedField {
  // Compact format: base64(iv).base64(authTag).base64(ciphertext)
  payload: string
}

export function encryptPii(plaintext: string): string {
  if (plaintext == null) return plaintext
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALG, getMasterKey(), iv)
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [iv.toString('base64'), tag.toString('base64'), ct.toString('base64')].join('.')
}

export function decryptPii(payload: string): string {
  if (payload == null) return payload
  const [ivB64, tagB64, ctB64] = payload.split('.')
  const iv = Buffer.from(ivB64, 'base64')
  const tag = Buffer.from(tagB64, 'base64')
  const ct = Buffer.from(ctB64, 'base64')
  const decipher = createDecipheriv(ALG, getMasterKey(), iv)
  decipher.setAuthTag(tag)
  const pt = Buffer.concat([decipher.update(ct), decipher.final()])
  return pt.toString('utf8')
}

// Deterministic HMAC for lookup/uniqueness of `ci`. Not reversible.
export function hashPiiDeterministic(plaintext: string): string {
  return createHmac('sha256', getMasterKey())
    .update(plaintext + getSalt())
    .digest('hex')
}

// One-way hash for IP / device fingerprint (audit/scoring only).
export function hashForAudit(value: string): string {
  return createHash('sha256')
    .update(value + getSalt())
    .digest('hex')
}

// Convenience wrappers bound to `ci` semantics.
export const encryptCi = (ci: string) => encryptPii(ci)
export const decryptCi = (enc: string) => decryptPii(enc)
export const hashCi = (ci: string) => hashPiiDeterministic(ci)
