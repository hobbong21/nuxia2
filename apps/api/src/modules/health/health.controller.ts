import { Controller, Get } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.module'

/**
 * Lightweight health endpoints for Docker HEALTHCHECK + Kubernetes probes.
 * - `/health` : liveness — process is running
 * - `/health/ready` : readiness — DB reachable
 *
 * Not auth-guarded. Never returns secrets.
 */
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  liveness() {
    return { ok: true, status: 'live', uptimeSec: Math.floor(process.uptime()) }
  }

  @Get('ready')
  async readiness() {
    try {
      await this.prisma.$queryRawUnsafe('SELECT 1')
      return { ok: true, status: 'ready' }
    } catch (err) {
      return { ok: false, status: 'db_unreachable' }
    }
  }
}
