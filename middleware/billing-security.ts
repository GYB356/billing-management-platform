import { NextResponse, type NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { securityMonitoring } from '@/lib/security-monitoring';

const PROTECTED_PATHS = [
  '/api/billing',
  '/api/subscriptions',
  '/api/invoices',
  '/api/payments',
  '/api/admin/billing',
];

const PERMISSION_MAP = {
  'GET': 'view:billing',
  'POST': 'manage:billing',
  'PUT': 'manage:billing',
  'DELETE': 'manage:billing',
};

export async function billingSecurity(
  request: NextRequest,
  response: NextResponse
) {
  try {
    // Check if the path should be protected
    const path = request.nextUrl.pathname;
    if (!PROTECTED_PATHS.some(p => path.startsWith(p))) {
      return response;
    }

    // Get the user's token
    const token = await getToken({ req: request });
    if (!token?.sub) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Get required permission based on HTTP method
    const requiredPermission = PERMISSION_MAP[request.method as keyof typeof PERMISSION_MAP] || 'view:billing';

    // Check if user has required permission
    const hasPermission = await securityMonitoring.checkPermission(
      token.sub,
      requiredPermission
    );

    if (!hasPermission) {
      // Log security event for unauthorized access attempt
      await securityMonitoring.logSecurityEvent({
        type: 'UNAUTHORIZED_ACCESS_ATTEMPT',
        severity: 'MEDIUM',
        metadata: {
          userId: token.sub,
          path,
          method: request.method,
          requiredPermission,
        },
      });

      return new NextResponse('Forbidden', { status: 403 });
    }

    // Log successful access for audit trail
    await securityMonitoring.logActivityEvent({
      userId: token.sub,
      action: 'API_ACCESS',
      resource: path,
      details: {
        method: request.method,
        permission: requiredPermission,
      },
      organizationId: token.organizationId as string,
    });

    return response;
  } catch (error) {
    console.error('Error in billing security middleware:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}