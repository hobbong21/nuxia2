import { Injectable, Logger } from '@nestjs/common'

export interface EmailSendParams {
  to: string
  subject: string
  text: string
}

export interface IEmailAdapter {
  send(params: EmailSendParams): Promise<void>
}

/**
 * v0.5 M3 — 이메일 발송 어댑터.
 *
 * 기본: Nodemailer(SMTP).
 * 환경변수 `OTP_DRY_RUN=1` 이면 실제 발송 대신 console.log.
 *
 * 실전 연동 시 `nodemailer` 패키지 추가 후 `sendMail()` 호출 교체.
 */
@Injectable()
export class NodemailerAdapter implements IEmailAdapter {
  private readonly logger = new Logger('NodemailerAdapter')

  async send(params: EmailSendParams): Promise<void> {
    const dryRun = process.env.OTP_DRY_RUN === '1'
    if (dryRun) {
      this.logger.log(
        `[OTP dry-run] EMAIL to ${maskEmail(params.to)} · ${params.subject} · ${params.text}`,
      )
      return
    }

    const host = process.env.SMTP_HOST
    const port = Number(process.env.SMTP_PORT ?? '587')
    const user = process.env.SMTP_USER
    const pass = process.env.SMTP_PASS
    const from = process.env.SMTP_FROM ?? 'no-reply@nuxia2.kr'
    if (!host || !user || !pass) {
      throw new Error(
        'SMTP_HOST / SMTP_USER / SMTP_PASS env missing (or set OTP_DRY_RUN=1 for development)',
      )
    }

    // TODO(v0.5-realdispatch): nodemailer 연동
    //   const nodemailer = require('nodemailer')
    //   const transport = nodemailer.createTransport({ host, port, auth: { user, pass } })
    //   await transport.sendMail({ from, to: params.to, subject: params.subject, text: params.text })
    this.logger.warn('[NodemailerAdapter] production send path not implemented — falling back to dry-run log')
    this.logger.log(`EMAIL to ${maskEmail(params.to)}: ${params.text}`)
  }
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!local || !domain) return '***'
  const maskedLocal = local.length <= 2 ? '*'.repeat(local.length) : `${local[0]}***${local.slice(-1)}`
  return `${maskedLocal}@${domain}`
}
