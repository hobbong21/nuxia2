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
    @Query('cursor') cursor?: string,
  ) {
    return this.svc.listAbuseLogs({
      kind,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      limit: limit ? Number(limit) : undefined,
      cursor,
    })
  }

  /** v0.2 S2 — 3-depth referral tree for admin inspection */
  @Get('users/:id/tree')
  userTree(@Param('id') id: string) {
    return this.svc.getUserTree(id)
  }

  /** v0.2 S2 — 어뷰징 심사 전환 (status=UNDER_REVIEW) */
  @Post('users/:id/flag')
  flagUser(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { reason: string },
  ) {
    return this.svc.flagUser(id, req.user.userId, body.reason)
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
