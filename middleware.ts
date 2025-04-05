import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { pciComplianceMiddleware } from './middleware/pci-compliance';

export async function middleware(request: NextRequest) {
  // Apply PCI compliance checks first
  const pciResponse = await pciComplianceMiddleware(request);
  if (pciResponse.status !== 200) {
    return pciResponse;
  }

  // Continue with other middleware if PCI checks pass
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Add routes that need PCI compliance checking
    '/api/payment-methods/:path*',
    '/api/transactions/:path*',
    '/api/checkout/:path*',
    '/api/billing/:path*',
    '/api/privacy/:path*'
  ]
};
