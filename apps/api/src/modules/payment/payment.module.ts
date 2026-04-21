import { Module } from '@nestjs/common'
import { ReferralModule } from '../referral/referral.module'
import { PaymentController } from './payment.controller'
import { PaymentService } from './payment.service'
import { PortOneClient } from './portone.client'

@Module({
  imports: [ReferralModule],
  providers: [PaymentService, PortOneClient],
  controllers: [PaymentController],
  exports: [PaymentService, PortOneClient],
})
export class PaymentModule {}
