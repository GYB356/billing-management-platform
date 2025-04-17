import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { withTimeout, withRetry } from '@/lib/utils/async';
import { requiresAuth } from '@/lib/auth/helpers';
import { applySecurityHeaders } from '@/lib/security/headers';

function withGracePeriod(expiration: number, grace: number): boolean {
  const currentTime = Math.floor(Date.now() / 1000);
  return expiration - grace < currentTime;
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  try {
    const token = await withRetry(
      async () => {
        return await withTimeout(
          getToken({ req: request, secret: process.env.NEXTAUTH_SECRET }),
          10000,
          'Token verification timeout'
        );
      },
      3,
      1000
    );

    if (!token) {
      return NextResponse.redirect(new URL('/auth/login', request.url));
    }

    if (requiresAuth(pathname) && withGracePeriod(token.exp as number, 30)) {
      return NextResponse.redirect(new URL('/auth/login', request.url));
    }

    const response = NextResponse.next();
    applySecurityHeaders(response);
    return response;
  } catch (error: unknown) {
    console.error('Middleware error:', error instanceof Error ? error.message : 'Unknown error');
    return new NextResponse('Internal Server Error', { status: 500 });
  }
} 