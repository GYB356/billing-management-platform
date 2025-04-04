import { NextResponse } from 'next/server';

// Security headers configuration
const SECURITY_HEADERS = {
  // Prevent clickjacking
  'X-Frame-Options': 'DENY',
  // Prevent MIME type sniffing
  'X-Content-Type-Options': 'nosniff',
  // Enable XSS protection
  'X-XSS-Protection': '1; mode=block',
  // Control referrer information
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  // Enable HSTS (uncomment in production)
  // 'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  // Permissions policy
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  // Cross-Origin Embedder Policy
  'Cross-Origin-Embedder-Policy': 'require-corp',
  // Cross-Origin Opener Policy
  'Cross-Origin-Opener-Policy': 'same-origin',
  // Cross-Origin Resource Policy
  'Cross-Origin-Resource-Policy': 'same-origin',
};

// Content Security Policy
const CSP_DIRECTIVES = {
  'default-src': ["'self'"],
  'script-src': [
    "'self'",
    "'unsafe-inline'",
    "'unsafe-eval'",
    'https://*.stripe.com',
    'https://*.googleapis.com',
  ],
  'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
  'img-src': [
    "'self'",
    'data:',
    'https://*.stripe.com',
    'https://*.googleapis.com',
    'https://*.googleusercontent.com',
  ],
  'font-src': ["'self'", 'https://fonts.gstatic.com'],
  'connect-src': [
    "'self'",
    'https://*.stripe.com',
    'https://api.stripe.com',
    'https://*.googleapis.com',
  ],
  'frame-src': ['https://*.stripe.com', 'https://*.googleapis.com'],
  'object-src': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
  'frame-ancestors': ["'none'"],
  'block-all-mixed-content': [],
  'upgrade-insecure-requests': [],
};

// Generate CSP header value
function generateCSPHeader(): string {
  return Object.entries(CSP_DIRECTIVES)
    .map(([key, values]) => {
      if (values.length === 0) return key;
      return `${key} ${values.join(' ')}`;
    })
    .join('; ');
}

// Add security headers to response
export function addSecurityHeaders(response: NextResponse): NextResponse {
  const headers = new Headers(response.headers);

  // Add basic security headers
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    headers.set(key, value);
  });

  // Add CSP header
  headers.set('Content-Security-Policy', generateCSPHeader());

  // Create new response with security headers
  return new NextResponse(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

// Security headers middleware
export function withSecurityHeaders(
  handler: (req: Request) => Promise<NextResponse>
) {
  return async (req: Request) => {
    const response = await handler(req);
    return addSecurityHeaders(response);
  };
}

// Development mode security headers (less restrictive)
const DEV_SECURITY_HEADERS = {
  ...SECURITY_HEADERS,
  'Content-Security-Policy': "default-src 'self' 'unsafe-inline' 'unsafe-eval';",
};

// Add development security headers
export function addDevSecurityHeaders(response: NextResponse): NextResponse {
  const headers = new Headers(response.headers);

  Object.entries(DEV_SECURITY_HEADERS).forEach(([key, value]) => {
    headers.set(key, value);
  });

  return new NextResponse(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
} 