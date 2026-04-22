import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { AbuseKind, UserRole } from '@prisma/client'
import { JwtAuthGuard, Roles, RolesGuard } from '../../common/guards/auth.guard'
import { AdminApiKeyGuard } from '../../common/guards/admin-api-key.guard'
import { Audit } from '../audit/audit.decorator'
import { AuditLogInterceptor } from '../audit/audit.interceptor'
import { AdminService } from './admin.service'

/**
 * v0.4 M1/M4/S3 — Admin controller.
 *
 * - 모든 엔드포인트: JWT + Roles(ADMIN) + (S3) AdminApiKeyGuard 3중 보호
 * - Mutating 엔드포인트: `@Audit(kind)` + AuditLogInterceptor 로 자동 기록
 */
@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, AdminApiKeyGuard)
@UseInterceptors(AuditLogInterceptor)
@Roles('ADMIN')
@Controller('admin')
export class AdminController {
  constructor(private readonly svc: AdminService) {}

  // --------------------------- v0.4 M1 신규 ---------------------------

  @Get('kpi')
  kpi() {
    return this.svc.getKpi()
  }

  @Get('users')
  listUsers(
    @Query('query') query?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.listUsers({
      query,
      cursor,
      limit: limit ? Number(limit) : undefined,
    })
  }

  @Get('users/:id')
  getUser(@Param('id') id: string) {
    return this.svc.getUser(id)
  }

  @Get('payouts')
  listPayouts(
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.listPayouts({
      cursor,
      limit: limit ? Number(limit) : undefined,
    })
  }

  // --------------------------- 기존 ---------------------------

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

  @Get('users/:id/tree')
  userTree(@Param('id') id: string) {
    return this.svc.getUserTree(id)
  }

  @Post('users/:id/flag')
  @Audit('USER_FLAG', { targetType: 'User' })
  flagUser(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { reason: string },
  ) {
    return this.svc.flagUser(id, req.user.userId, body.reason)
  }

  @Post('users/:id/mark-staff')
  @Audit('USER_MARK_STAFF', { targetType: 'User', captureBody: true })
  markStaff(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { role: UserRole },
  ) {
    return this.svc.markStaff(id, body.role, req.user.userId)
  }

  @Post('users/:id/suspend')
  @Audit('USER_SUSPEND', { targetType: 'User' })
  suspend(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { reason: string },
  ) {
    return this.svc.suspendUser(id, req.user.userId, body.reason)
  }

  @Post('users/:id/release-minor')
  @Audit('USER_RELEASE_MINOR', { targetType: 'User' })
  releaseMinor(@Req() req: any, @Param('id') id: string) {
    return this.svc.releaseMinor(id, req.user.userId)
  }

  @Post('payouts/run')
  @Audit('PAYOUT_RUN', { targetType: 'Payout', captureBody: true })
  runPayout(
    @Req() req: any,
    @Body() body: { periodStart: string; periodEnd: string },
  ) {
    return this.svc.runPayout(body.periodStart, body.periodEnd, req.user.userId)
  }

  @Post('payouts/:id/release')
  @Audit('PAYOUT_RELEASE', { targetType: 'Payout' })
  releasePayout(@Req() req: any, @Param('id') id: string) {
    return this.svc.releasePayout(id, req.user.userId)
  }
}
