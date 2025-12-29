import { NextRequest, NextResponse } from 'next/server';

export function proxy(req: NextRequest) {
  const hasToken = req.cookies.get('accessToken');

  if (!hasToken && req.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/auth/login', req.url));
  }
}
