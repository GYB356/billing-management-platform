import { withAuth, NextRequestWithAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';
import { RateLimiterMemory } from 'rate-limiter-flexible';

const rateLimiter = new RateLimiterMemory({
  points: 10, // 10 requests
  duration: 60, // per 60 seconds by IP
});

export default withAuth(
  async function middleware(req: NextRequestWithAuth) {
    try {
      await rateLimiter.consume(req.ip);
    } catch (rejRes) {
      const url = req.nextUrl.clone();
      url.pathname = '/429'; // Redirect to a custom 429 page
      return NextResponse.redirect(url);
    }

    const token = req.nextauth.token;
    const twoFactorVerified = token?.twoFactorVerified;

    if (!twoFactorVerified) {
      const url = req.nextUrl.clone();
      url.pathname = '/auth/two-factor';
      return NextResponse.redirect(url);
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }: { token: any }) => !!token && token.twoFactorVerified,
    },
    pages: {
      signIn: '/auth/signin',
    },
  }
);

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/api/protected/:path*',
    // Add other protected routes here
  ],
}; 