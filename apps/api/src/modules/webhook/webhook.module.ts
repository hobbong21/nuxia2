import { Module } from '@nestjs/common'
import { ReferralModule } from '../referral/referral.module'
import { PaymentModule } from '../payment/payment.module'
import { PortoneWebhookController } from './portone.webhook.controller'

@Module({
  imports: [ReferralModule, PaymentModule],
  controllers: [PortoneWebhookController],
})
export class WebhookModule {}
