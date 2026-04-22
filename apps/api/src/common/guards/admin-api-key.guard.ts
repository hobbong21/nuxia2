import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'

/**
 * v0.4 S3 — Admin API 2중 보호층.
 *
 * JWT role=ADMIN 외에 `X-Admin-Api-Key` 헤더로 추가 확인.
 * - `ADMIN_API_KEY` env 가 있을 때만 활성 (개발 환경에서는 optional)
 * - 헤더 불일치 시 401
 */
@Injectable()
export class AdminApiKeyGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const expected = process.env.ADMIN_API_KEY
    // dev 환경: env 없으면 스킵 (로컬 테스트 편의)
    if (!expected || expected.length === 0) return true

    const req = ctx.switchToHttp().getRequest<any>()
    const provided =
      req?.headers?.['x-admin-api-key'] ?? req?.headers?.['X-Admin-Api-Key']
    if (!provided || provided !== expected) {
      throw new UnauthorizedException({
        code: 'ADMIN_API_KEY_INVALID',
        message: 'Invalid or missing X-Admin-Api-Key header',
      })
    }
    return true
  }
}
