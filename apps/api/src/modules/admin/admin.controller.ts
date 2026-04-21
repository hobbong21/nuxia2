import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { AbuseKind, UserRole } from '@prisma/client'
import { JwtAuthGuard, Roles, RolesGuard } from '../../common/guards/auth.guard'
import { AdminService } from './admin.service'

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin')
export class AdminController {
  constructor(private readonly svc: AdminService) {}

  @Get('abuse-logs')
  listAbuse(
    @Query('kind') kind?: AbuseKind,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.listAbuseLogs({
      kind,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      limit: limit ? Number(limit) : undefined,
    })
  }

  @Post('users/:id/mark-staff')
  markStaff(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { role: UserRole },
  ) {
    return this.svc.markStaff(id, body.role, req.user.userId)
  }

  @Post('users/:id/suspend')
  suspend(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { reason: string },
  ) {
    return this.svc.suspendUser(id, req.user.userId, body.reason)
  }

  @Post('users/:id/release-minor')
  releaseMinor(@Req() req: any, @Param('id') id: string) {
    return this.svc.releaseMinor(id, req.user.userId)
  }

  @Post('payouts/run')
  runPayout(
    @Req() req: any,
    @Body() body: { periodStart: string; periodEnd: string },
  ) {
    return this.svc.runPayout(body.periodStart, body.periodEnd, req.user.userId)
  }

  @Post('payouts/:id/release')
  releasePayout(@Req() req: any, @Param('id') id: string) {
    return this.svc.releasePayout(id, req.user.userId)
  }
}
