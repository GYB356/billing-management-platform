import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { pciComplianceMiddleware } from './middleware/pci-compliance';
import { billingSecurity } from './middleware/billing-security';

export async function middleware(request: NextRequest) {
  // Apply PCI compliance checks first
  const pciResponse = await pciComplianceMiddleware(request);
  if (pciResponse.status !== 200) {
    return pciResponse;
  }

  // Create the response
  const response = NextResponse.next();

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
    // Add routes that need PCI compliance checking
    '/api/payment-methods/:path*',
    '/api/transactions/:path*',
    '/api/checkout/:path*',
    '/api/billing/:path*',
    '/api/privacy/:path*',
    '/api/subscriptions/:path*',
    '/api/invoices/:path*',
    '/api/payments/:path*',
    '/api/admin/billing/:path*',
  ]
};
