import { NextRequest, NextResponse } from 'next/server';

/**
 * v0.3 M1-3 — role guard.
 *
 * /admin/* 경로 접근 시 쿠키에서 role 을 읽어 ADMIN 이 아니면 / 로 리다이렉트.
 *
 * TODO(auth): 현재는 쿠키 기반 mock. v0.4 에서 실제 JWT 세션 (httpOnly cookie 또는 Authorization
 * interceptor) 도입 시 `cookies.get('nx_role')` → JWT 파싱으로 대체.
 *
 * 개발 편의: NEXT_PUBLIC_ADMIN_BYPASS=1 로 빌드된 환경에서는 가드를 우회한다.
 * 프로덕션 빌드(NODE_ENV=production) 에서는 우회 플래그를 무시하여 오·배포를 방지.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!pathname.startsWith('/admin')) return NextResponse.next();

  const bypass =
    process.env.NEXT_PUBLIC_ADMIN_BYPASS === '1' &&
    process.env.NODE_ENV !== 'production';
  if (bypass) return NextResponse.next();

  const role = req.cookies.get('nx_role')?.value;
  if (role === 'ADMIN') return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = '/';
  url.searchParams.set('reason', 'admin_required');
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/admin/:path*'],
};
