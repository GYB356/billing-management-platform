import { NextRequest, NextResponse } from 'next/server';
import { verifyApiToken, recordApiTokenUsage, InsufficientScopeError } from '@/lib/auth/apiToken';

/**
 * Middleware to authenticate API requests using API tokens
 */
export async function apiAuthMiddleware(request: NextRequest) {
  try {
    // Skip authentication for public API routes
    const path = request.nextUrl.pathname;
    if (
      path.startsWith('/api/auth') ||
      path === '/api/health' ||
      path === '/api/webhooks/stripe' ||
      path.startsWith('/api/public')
    ) {
      return NextResponse.next();
    }

    // Get token from Authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new NextResponse(
        JSON.stringify({ error: 'Missing or invalid Authorization header' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.split(' ')[1];
    const startTime = Date.now();

    try {
      // Verify token (scopes will be checked in the route handler)
      const apiToken = await verifyApiToken(token);

      // Clone the request to add custom headers
      const requestWithAuth = new Request(request.url, {
        method: request.method,
        headers: new Headers(request.headers),
        body: request.body,
        cache: request.cache,
        credentials: request.credentials,
        integrity: request.integrity,
        keepalive: request.keepalive,
        mode: request.mode,
        redirect: request.redirect,
        referrer: request.referrer,
        referrerPolicy: request.referrerPolicy,
      });

      // Add token info to request headers
      requestWithAuth.headers.set('x-api-token-id', apiToken.id);
      requestWithAuth.headers.set('x-api-user-id', apiToken.userId);
      requestWithAuth.headers.set('x-api-token-scopes', apiToken.scopes.join(','));

      // Record successful request
      await recordApiTokenUsage(
        apiToken.id,
        request.nextUrl.pathname,
        request.method,
        200, // Status will be updated in the response
        request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '',
        request.headers.get('user-agent') || '',
        Date.now() - startTime
      );

      // Return modified request
      return NextResponse.next({
        request: requestWithAuth
      });
    } catch (error) {
      // Handle specific errors
      if (error instanceof InsufficientScopeError) {
        return new NextResponse(
          JSON.stringify({ error: 'Insufficient permissions' }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }
      
      return new NextResponse(
        JSON.stringify({ error: 'Invalid API token' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('API authentication error:', error);
    return new NextResponse(
      JSON.stringify({ error: 'Authentication failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// Helper function to extract API token info from request
export function getApiTokenFromRequest(request: Request) {
  return {
    id: request.headers.get('x-api-token-id') || '',
    userId: request.headers.get('x-api-user-id') || '',
    scopes: (request.headers.get('x-api-token-scopes') || '').split(',').filter(Boolean),
  };
}

// Helper to check required scopes
export function checkRequiredScopes(request: Request, requiredScopes: string[]) {
  const { scopes } = getApiTokenFromRequest(request);
  
  if (!requiredScopes || requiredScopes.length === 0) {
    return true;
  }
  
  // Check if token has all required scopes
  return requiredScopes.every(scope => scopes.includes(scope));
} 