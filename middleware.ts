import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { getToken } from 'next-auth/jwt';
import type { NextRequest } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { hasPermission, Permission } from './lib/auth/rbac';

const prisma = new PrismaClient();

// Initialize rate limiter
const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(20, "10 s"), // 20 requests per 10 seconds
  analytics: true,
});

// Define protected routes and required permissions
const routePermissions: Record<string, Permission> = {
  // Admin routes
  '/admin': 'manage:organizations',
  
  // User management
  '/admin/users': 'manage:users',
  
  // Settings routes
  '/settings': 'view:settings',
  '/settings/profile': 'view:settings',
  '/settings/organization': 'view:settings',
  '/settings/billing': 'view:billing',
  '/settings/team': 'view:users',
  
  // Subscription routes
  '/subscription': 'view:subscriptions',
  '/subscription/manage': 'manage:subscriptions',
  '/subscription/analytics': 'view:analytics',
  
  // Analytics routes
  '/analytics': 'view:analytics',
  '/analytics/revenue': 'view:analytics',
  '/analytics/usage': 'view:analytics',
  
  // Invoice routes
  '/invoices': 'view:invoices',
  '/invoices/create': 'manage:invoices',
  
  // Tax routes
  '/tax': 'view:taxes',
  '/tax/settings': 'manage:taxes',
};

export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request });
  const path = request.nextUrl.pathname;

  // Check if the route is protected
  const matchingRoute = Object.entries(routePermissions).find(([route]) =>
    path.startsWith(route) || path === route
  );

  if (matchingRoute) {
    // If user is not authenticated, redirect to login
    if (!token) {
      const loginUrl = new URL('/auth/signin', request.url);
      loginUrl.searchParams.set('callbackUrl', path);
      return NextResponse.redirect(loginUrl);
    }

    // Check if user has required permission
    const [_, requiredPermission] = matchingRoute;
    const userRole = token.role as any;
    const orgRole = token.organizationRole as any || 'MEMBER';
    
    if (!hasPermission(userRole, orgRole, requiredPermission)) {
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }
  }

  // Handle organization-specific routes
  if (path.startsWith('/organization/')) {
    if (!token) {
      return NextResponse.redirect(new URL('/auth/signin', request.url));
    }

    // Extract organization ID from path
    const orgId = path.split('/')[2];
    if (!orgId) {
      return NextResponse.redirect(new URL('/organizations', request.url));
    }

    // Check if user has access to this organization
    const userOrg = await prisma.userOrganization.findFirst({
      where: {
        userId: token.id as string,
        organizationId: orgId,
      },
    });

    if (!userOrg) {
      return NextResponse.redirect(new URL('/organizations', request.url));
    }
  }

  // Apply rate limiting for API routes
  if (path.startsWith('/api/')) {
    // Use IP for non-authenticated requests, user ID for authenticated ones
    const identifier = token ? `user_${token.id}` : `ip_${request.ip}`;
    const { success, limit, reset, remaining } = await ratelimit.limit(identifier);

    if (!success) {
      return new NextResponse(
        JSON.stringify({
          error: 'Too many requests',
          limit,
          remaining,
          reset: new Date(reset).toISOString(),
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': limit.toString(),
            'X-RateLimit-Remaining': remaining.toString(),
            'X-RateLimit-Reset': new Date(reset).toISOString(),
          },
        }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/settings/:path*',
    '/subscription/:path*',
    '/analytics/:path*',
    '/organization/:path*',
    '/invoices/:path*',
    '/tax/:path*',
    '/api/:path*',
  ],
}; 