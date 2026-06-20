import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  const hasAccessToken = req.cookies.get('accessToken');
  const hasRefreshToken = req.cookies.get('refreshToken');

  if (!hasAccessToken && !hasRefreshToken && req.nextUrl.pathname.startsWith('/me')) {
    return NextResponse.redirect(new URL('/auth/login', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/me', '/me/:path*'],
};
