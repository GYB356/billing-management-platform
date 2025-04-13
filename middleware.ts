import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { pciComplianceMiddleware } from './middleware/pci-compliance';
import { billingSecurity } from './middleware/billing-security';
import { apiAuthMiddleware } from './middleware/apiAuth';
import { createAuditLogMiddleware } from './lib/logging/audit';
import { getToken } from 'next-auth/jwt';
import { withRetry } from './lib/auth-utils';
import { isRateLimited } from './lib/rate-limiter';

const auditLogMiddleware = createAuditLogMiddleware();

// Configuration for auth protected paths
const publicPaths = [
  '/',
  '/auth/login',
  '/auth/register',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/api/auth/',
  '/api/webhooks/',
  '/api/public/',
  '/api/health',
  '/_next/',
  '/favicon.ico',
  '/robots.txt',
  '/sitemap.xml',
];

const authPaths = [
  '/dashboard',
  '/settings',
  '/profile',
  '/payment',
  '/billing',
  '/usage',
  '/account',
  '/invoices',
  '/analytics',
  '/customer-portal',
];

// Helper function to implement timeout for promises
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
  let timeoutId: NodeJS.Timeout;
  
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(errorMessage));
    }, timeoutMs);
  });
  
  return Promise.race([
    promise.then(result => {
      clearTimeout(timeoutId);
      return result;
    }),
    timeoutPromise
  ]);
}

// Helper functions for path checking
const isPublic = (path: string): boolean => publicPaths.some(p => path.startsWith(p));
const requiresAuth = (path: string): boolean => authPaths.some(p => path.startsWith(p));

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  
  // Check rate limiting for authentication endpoints
  if (pathname.startsWith('/auth/')) {
    if (isRateLimited(request)) {
      return new NextResponse(
        JSON.stringify({
          error: 'Too many requests',
          message: 'Please try again later'
        }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  try {
    // Get the user's session token with retry logic and monitoring
    const token = await withRetry(
      async () => await withTimeout(
        getToken({
          req: request,
          secret: process.env.NEXTAUTH_SECRET,
        }),
        10000,
        'Session token verification timed out'
      ),
      3, // max 3 attempts
      1000, // 1 second initial delay between retries
      'token-verification'
    );

    // Enhanced token expiration check with grace period
    const currentTime = Math.floor(Date.now() / 1000);
    const gracePeriod = 30; // 30 seconds grace period for clock sync issues

    // Add detailed context for debugging
    const authContext = {
      path: pathname,
      hasToken: !!token,
      tokenExp: token?.exp,
      currentTime,
      isPublic: isPublic(pathname),
      requiresAuth: requiresAuth(pathname)
    };

    console.debug('Auth context:', authContext);

    if (isPublic(pathname) && token && pathname.startsWith('/auth/')) {
      console.info(`Redirecting authenticated user from ${pathname} to dashboard`, authContext);
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
      
    if (requiresAuth(pathname) && !token) {
      console.warn('Auth required but no token found', {
        path: pathname,
        ip: request.ip,
        timestamp: new Date().toISOString()
      });
      const redirectUrl = new URL('/auth/login', request.url);
      redirectUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(redirectUrl);
    }
      
    if (requiresAuth(pathname) && token && ((token.exp as number) - gracePeriod) < currentTime) {
      console.warn('Session expired', {
        ...authContext,
        tokenAge: currentTime - (token.iat as number),
        gracePeriodRemaining: (token.exp as number) - currentTime
      });
      const redirectUrl = new URL('/auth/login', request.url);
      redirectUrl.searchParams.set('callbackUrl', pathname);
      redirectUrl.searchParams.set('error', 'SessionExpired');
      return NextResponse.redirect(redirectUrl);
    }

    const response = NextResponse.next();
    applySecurityHeaders(response);
    return response;
  } catch (error) {
    console.error('Authentication error:', {
      path: pathname,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    // Handle different types of errors appropriately
    if (error instanceof Error && error.message.includes('timed out')) {
      return new NextResponse(
        JSON.stringify({
          error: 'Authentication timeout',
          message: 'Please try again'
        }),
        {
          status: 503,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
    }

    return new NextResponse(
      JSON.stringify({
        error: 'Authentication error',
        message: 'An unexpected error occurred'
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  }
}

// Apply security headers to response
function applySecurityHeaders(response: NextResponse) {
  const headers = response.headers;
  
  // Ensure cookies are secure (HTTPS only)
  headers.set('Set-Cookie', 'Path=/; Secure; HttpOnly; SameSite=Strict');
  
  // Content Security Policy
  headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.stripe.com; frame-src 'self' https://*.stripe.com; connect-src 'self' https://*.stripe.com; img-src 'self' data: https://*.stripe.com; style-src 'self' 'unsafe-inline';"
  );
  
  // Strict Transport Security
  headers.set(
    'Strict-Transport-Security',
    'max-age=63072000; includeSubDomains; preload'
  );
  
  // X-Content-Type-Options
  headers.set('X-Content-Type-Options', 'nosniff');
  
  // X-Frame-Options
  headers.set('X-Frame-Options', 'DENY');
  
  // X-XSS-Protection
  headers.set('X-XSS-Protection', '1; mode=block');
  
  // Referrer-Policy
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Permissions-Policy
  headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), interest-cohort=()'
  );
}

// Middleware config
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
