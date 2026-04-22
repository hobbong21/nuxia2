import { Module } from '@nestjs/common'
import { ReferralController } from './referral.controller'
import { ReferralDashboardService } from './dashboard.service'
import { ReferralEngineService } from './engine.service'
import { MetricsModule } from '../metrics/metrics.module'

@Module({
  imports: [MetricsModule],
  providers: [ReferralEngineService, ReferralDashboardService],
  controllers: [ReferralController],
  exports: [ReferralEngineService, ReferralDashboardService],
})
export class ReferralModule {}
