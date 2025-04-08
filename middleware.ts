import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { pciComplianceMiddleware } from './middleware/pci-compliance';
import { billingSecurity } from './middleware/billing-security';
import { apiAuthMiddleware } from './middleware/apiAuth';
import { createAuditLogMiddleware } from './lib/logging/audit';
import { getToken } from 'next-auth/jwt';

const auditLogMiddleware = createAuditLogMiddleware();

// Configuration for auth protected paths
const config = {
  // Public paths that don't require authentication
  publicPaths: [
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
  ],
  // Paths that should redirect to login when unauthenticated
  authPaths: [
    '/dashboard',
    '/settings',
    '/profile',
    '/payment',
    '/billing',
    '/usage',
    '/account',
  ],
};

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

export async function middleware(request: NextRequest) {
  // Get the pathname of the request
  const pathname = request.nextUrl.pathname;
  
  // Skip processing for static files
  if (pathname.includes('.') && 
      !pathname.startsWith('/api')) {
    return NextResponse.next();
  }
  
  // API routes handling
  if (pathname.startsWith('/api')) {
    // Skip audit logging for health checks
    if (pathname.startsWith('/api/health')) {
      return NextResponse.next();
    }
    
    try {
      // Apply API authentication middleware with timeout
      const apiAuthResponse = await withTimeout(
        apiAuthMiddleware(request),
        5000, // 5 second timeout
        'API authentication timed out'
      );
      
      if (apiAuthResponse.status !== 200) {
        return apiAuthResponse;
      }
      
      // Apply PCI compliance checks with timeout
      const pciResponse = await withTimeout(
        pciComplianceMiddleware(request),
        3000, // 3 second timeout
        'PCI compliance check timed out'
      );
      
      if (pciResponse.status !== 200) {
        return pciResponse;
      }
      
      const response = NextResponse.next();
      
      // Add audit logging with timeout
      try {
        await withTimeout(
          auditLogMiddleware(request, response, () => {}),
          3000, // 3 second timeout
          'Audit logging timed out'
        );
      } catch (auditError) {
        // Log but continue if audit logging fails
        console.error('Audit logging error:', auditError);
      }
      
      // Apply billing security middleware with timeout
      try {
        const billingSecurityResult = await withTimeout(
          billingSecurity(request, response),
          3000, // 3 second timeout
          'Billing security check timed out'
        );
        
        if (billingSecurityResult.status !== 200) {
          return billingSecurityResult;
        }
        
        // Apply security headers
        applySecurityHeaders(response);
        
        return response;
      } catch (error) {
        console.error('API middleware error:', error);
        if (error.message && error.message.includes('timed out')) {
          return new NextResponse(
            JSON.stringify({ error: error.message }),
            { status: 504, headers: { 'Content-Type': 'application/json' } }
          );
        }
        return new NextResponse(
          JSON.stringify({ error: 'Internal Server Error' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }
    } catch (error) {
      console.error('API middleware error:', error);
      if (error.message && error.message.includes('timed out')) {
        return new NextResponse(
          JSON.stringify({ error: error.message }),
          { status: 504, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new NextResponse(
        JSON.stringify({ error: 'Internal Server Error' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }
  
  // Web routes handling
  try {
    // Check if the path is public or requires auth
    const isPublic = isPublicPath(pathname);
    const requiresAuth = isAuthPath(pathname);
    
    try {
      // Get the user's session token with timeout
      const token = await withTimeout(
        getToken({
          req: request,
          secret: process.env.NEXTAUTH_SECRET,
        }),
        3000, // 3 second timeout
        'Session token verification timed out'
      );
      
      // User is logged in and trying to access a public auth page (login/register)
      if (isPublic && token && pathname.startsWith('/auth/')) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
      
      // User is not logged in and trying to access a protected path
      if (requiresAuth && !token) {
        const redirectUrl = new URL('/auth/login', request.url);
        redirectUrl.searchParams.set('callbackUrl', pathname);
        return NextResponse.redirect(redirectUrl);
      }
      
      // Session validation timeouts - redirect to login if token is invalid
      if (requiresAuth && token && (token.exp as number) < Math.floor(Date.now() / 1000)) {
        const redirectUrl = new URL('/auth/login', request.url);
        redirectUrl.searchParams.set('callbackUrl', pathname);
        redirectUrl.searchParams.set('error', 'SessionExpired');
        return NextResponse.redirect(redirectUrl);
      }
      
      // Pass through for all other cases
      const response = NextResponse.next();
      applySecurityHeaders(response);
      return response;
    } catch (error) {
      console.error('Session verification error:', error);
      if (error.message && error.message.includes('timed out') && requiresAuth) {
        // If session verification times out on an auth path, redirect to login
        const redirectUrl = new URL('/auth/login', request.url);
        redirectUrl.searchParams.set('callbackUrl', pathname);
        redirectUrl.searchParams.set('error', 'VerificationTimeout');
        return NextResponse.redirect(redirectUrl);
      }
      
      // For public paths or other errors, just continue
      const response = NextResponse.next();
      applySecurityHeaders(response);
      return response;
    }
  } catch (error) {
    console.error('Middleware error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
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

// Configure matcher for middleware
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)'
  ],
};

// Helper functions to check path types
function isPublicPath(pathname: string): boolean {
  return config.publicPaths.some(path => {
    if (path.endsWith('/')) {
      return pathname.startsWith(path);
    }
    return pathname === path;
  });
}

function isAuthPath(pathname: string): boolean {
  return config.authPaths.some(path => {
    if (path.endsWith('/')) {
      return pathname.startsWith(path);
    }
    return pathname.startsWith(path);
  });
}
