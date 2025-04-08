import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { pciComplianceMiddleware } from './middleware/pci-compliance';
import { billingSecurity } from './middleware/billing-security';
import { apiAuthMiddleware } from './middleware/apiAuth';
import { createAuditLogMiddleware } from './lib/logging/audit';
import { getToken } from 'next-auth/jwt';

const auditLogMiddleware = createAuditLogMiddleware();

export async function middleware(request: NextRequest) {
  // Skip audit logging for non-API routes and static files
  if (!request.nextUrl.pathname.startsWith('/api') || 
      request.nextUrl.pathname.startsWith('/api/health') ||
      request.nextUrl.pathname.includes('.')) {
    return NextResponse.next();
  }

  // Apply API authentication middleware
  const apiAuthResponse = await apiAuthMiddleware(request);
  if (apiAuthResponse.status !== 200) {
    return apiAuthResponse;
  }

  // Apply PCI compliance checks first
  const pciResponse = await pciComplianceMiddleware(request);
  if (pciResponse.status !== 200) {
    return pciResponse;
  }

  const response = NextResponse.next();

  // Add audit logging
  await auditLogMiddleware(request, response, () => {});

  try {
    // Apply billing security middleware
    const billingSecurityResult = await billingSecurity(request, response);
    if (billingSecurityResult.status !== 200) {
      return billingSecurityResult;
    }
    
    // Get the pathname of the request
    const path = request.nextUrl.pathname;
    
    // Define public paths that don't require authentication
    const isPublicPath = 
      path === '/login' || 
      path === '/register' || 
      path === '/forgot-password' || 
      path === '/reset-password' ||
      path.startsWith('/api/auth') ||
      path.startsWith('/_next') ||
      path.startsWith('/static') ||
      path.includes('.');
    
    // Get the token from the request
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });
    
    // Redirect logic for authentication
    if (isPublicPath && token) {
      // If the user is logged in and trying to access a public path, redirect to dashboard
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    
    if (!isPublicPath && !token) {
      // If the user is not logged in and trying to access a protected path, redirect to login
      const redirectUrl = new URL('/login', request.url);
      redirectUrl.searchParams.set('callbackUrl', path);
      return NextResponse.redirect(redirectUrl);
    }
    
    // Security headers
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
    
    return response;
  } catch (error) {
    console.error('Middleware error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

export const config = {
  matcher: [
    // Match all API routes except health checks and static files
    '/api/:path*',
    '/((?!_next/static|favicon.ico|health).*)',
  ],
};
