import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  const hasAccessToken = req.cookies.get('accessToken');
  const hasRefreshToken = req.cookies.get('refreshToken');
  const hasAdminAccessToken = req.cookies.get('adminAccessToken');
  const hasAdminRefreshToken = req.cookies.get('adminRefreshToken');
  const isAdminPath = req.nextUrl.pathname.startsWith('/admin');

  if (!hasAccessToken && !hasRefreshToken && req.nextUrl.pathname.startsWith('/me')) {
    return NextResponse.redirect(new URL('/auth/login', req.url));
  }

  if (
    isAdminPath &&
    req.nextUrl.pathname !== '/admin/login' &&
    !hasAdminAccessToken &&
    !hasAdminRefreshToken
  ) {
    return NextResponse.redirect(new URL('/admin/login', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/me', '/me/:path*', '/admin', '/admin/:path*'],
};
