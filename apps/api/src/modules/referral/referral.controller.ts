import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from '../../common/guards/auth.guard'
import { ReferralDashboardService } from './dashboard.service'

@ApiTags('referral')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('referral')
export class ReferralController {
  constructor(private readonly dash: ReferralDashboardService) {}

  @Get('dashboard')
  dashboard(@Req() req: any) {
    return this.dash.getSummary(req.user.userId)
  }

  @Get('tree')
  tree(@Req() req: any) {
    return this.dash.getTree(req.user.userId)
  }

  @Get('ledger')
  ledger(
    @Req() req: any,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.dash.getLedger(req.user.userId, {
      cursor,
      limit: limit ? Number(limit) : undefined,
    })
  }
}
