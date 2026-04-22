import { Global, Module } from '@nestjs/common'
import { MetricsService } from './metrics.service'
import { MetricsController } from './metrics.controller'

/**
 * v0.4 M3 — Metrics module (global so anywhere in the app can inc counters).
 */
@Global()
@Module({
  providers: [MetricsService],
  controllers: [MetricsController],
  exports: [MetricsService],
})
export class MetricsModule {}
