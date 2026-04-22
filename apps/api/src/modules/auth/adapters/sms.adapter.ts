import { Injectable, Logger } from '@nestjs/common'

export interface SmsSendParams {
  to: string // E.164
  body: string
}

export interface ISmsAdapter {
  send(params: SmsSendParams): Promise<void>
}

/**
 * v0.5 M3 — SMS 발송 어댑터.
 *
 * 기본: Solapi (한국 시장 표준).
 * 환경변수 `OTP_DRY_RUN=1` 이면 실제 발송 대신 console.log.
 *
 * 실전 연동 시 `solapi` 패키지 추가 후 `sendOne()` 호출 교체.
 */
@Injectable()
export class SolapiAdapter implements ISmsAdapter {
  private readonly logger = new Logger('SolapiAdapter')

  async send(params: SmsSendParams): Promise<void> {
    const dryRun = process.env.OTP_DRY_RUN === '1'
    if (dryRun) {
      // 실전 배포 전까지는 콘솔 로그로 테스트 가능
      this.logger.log(`[OTP dry-run] SMS to ${maskPhone(params.to)}: ${params.body}`)
      return
    }

    const apiKey = process.env.SMS_API_KEY
    const apiSecret = process.env.SMS_API_SECRET
    const fromNumber = process.env.SMS_FROM_NUMBER
    if (!apiKey || !apiSecret || !fromNumber) {
      throw new Error(
        'SMS_API_KEY / SMS_API_SECRET / SMS_FROM_NUMBER env missing (or set OTP_DRY_RUN=1 for development)',
      )
    }

    // TODO(v0.5-realdispatch): solapi 연동
    //   const { SolapiMessageService } = require('solapi')
    //   const client = new SolapiMessageService(apiKey, apiSecret)
    //   await client.sendOne({ to: params.to, from: fromNumber, text: params.body })
    this.logger.warn('[SolapiAdapter] production send path not implemented — falling back to dry-run log')
    this.logger.log(`SMS to ${maskPhone(params.to)}: ${params.body}`)
  }
}

function maskPhone(e164: string): string {
  if (e164.length < 7) return '***'
  return `${e164.slice(0, 3)}****${e164.slice(-3)}`
}
