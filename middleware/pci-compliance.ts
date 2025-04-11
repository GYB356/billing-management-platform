import { NextRequest, NextResponse } from 'next/server';
import { securityMonitoring } from '@/lib/security-monitoring';

const SENSITIVE_PAYMENT_ROUTES = [
  '/api/billing',
  '/api/payments',
  '/api/checkout',
];

export async function pciComplianceMiddleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  
  if (SENSITIVE_PAYMENT_ROUTES.some(route => path.startsWith(route))) {
    // Verify TLS version
    const tlsVersion = req.headers.get('x-forwarded-proto-version');
    if (!tlsVersion || parseFloat(tlsVersion) < 1.2) {
      await securityMonitoring.logSecurityEvent({
        type: 'PCI_COMPLIANCE_VIOLATION',
        severity: 'HIGH',
        metadata: { reason: 'Invalid TLS version', path }
      });
      return new NextResponse(
        JSON.stringify({ error: 'Insecure connection detected' }),
        { status: 426, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check for sensitive data in query parameters
    const hasCardDataInQuery = req.nextUrl.searchParams.toString().match(
      /(card[^=]*number|cvv|ccv|cvc|exp(iry)?_(month|year))/i
    );
    
    if (hasCardDataInQuery) {
      await securityMonitoring.logSecurityEvent({
        type: 'PCI_DATA_EXPOSURE',
        severity: 'CRITICAL',
        metadata: { reason: 'Sensitive data in URL', path }
      });
      return new NextResponse(
        JSON.stringify({ error: 'Invalid request format' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Add security headers
    const response = NextResponse.next();
    response.headers.set('Content-Security-Policy', "default-src 'self'; frame-ancestors 'none'");
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    
    return response;
  }

  return NextResponse.next();
}