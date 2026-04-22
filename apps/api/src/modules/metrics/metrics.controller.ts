import {
  Controller,
  Get,
  Header,
  Headers,
  Res,
  UnauthorizedException,
} from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { MetricsService } from './metrics.service'

/**
 * v0.4 M3 — GET /metrics.
 *
 * Prod: `X-Internal-Secret` 헤더가 `METRICS_INTERNAL_SECRET` env 와 일치해야 함.
 * Dev/test: public (NODE_ENV !== 'production').
 */
@ApiTags('metrics')
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  async metrics(
    @Headers('x-internal-secret') provided: string | undefined,
    @Res({ passthrough: true }) res: any,
  ) {
    if (process.env.NODE_ENV === 'production') {
      const expected = process.env.METRICS_INTERNAL_SECRET
      if (!expected || provided !== expected) {
        throw new UnauthorizedException({
          code: 'METRICS_FORBIDDEN',
          message: 'metrics endpoint requires X-Internal-Secret in production',
        })
      }
    }
    const { contentType, body } = await this.metrics.render()
    res?.setHeader?.('Content-Type', contentType)
    return body
  }
}
