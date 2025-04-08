import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { pciComplianceMiddleware } from './middleware/pci-compliance';
import { billingSecurity } from './middleware/billing-security';
import { apiAuthMiddleware } from './middleware/apiAuth';
import { createAuditLogMiddleware } from './lib/logging/audit';

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
