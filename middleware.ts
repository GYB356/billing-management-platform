import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { getToken } from "next-auth/jwt";

// Initialize rate limiter
const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(20, "10 s"), // 20 requests per 10 seconds
  analytics: true,
});

export default withAuth(
  async function middleware(req) {
    // Rate limiting
    const ip = req.ip ?? "127.0.0.1";
    const { success, limit, reset, remaining } = await ratelimit.limit(ip);
    
    if (!success) {
      return new NextResponse("Too Many Requests", {
        status: 429,
        headers: {
          "X-RateLimit-Limit": limit.toString(),
          "X-RateLimit-Remaining": remaining.toString(),
          "X-RateLimit-Reset": reset.toString(),
        },
      });
    }

    const token = await getToken({ req, secret: process.env.JWT_SECRET });
    const url = req.nextUrl.clone();

    // Protect admin routes
    if (url.pathname.startsWith('/admin')) {
      if (!token || token.role !== 'ADMIN') {
        url.pathname = '/';
        return NextResponse.redirect(url);
      }
    }

    const isApiRoute = req.nextUrl.pathname.startsWith("/api");

    // API route protection
    if (isApiRoute) {
      const response = NextResponse.next();
      
      // Security headers
      response.headers.set("X-Frame-Options", "DENY");
      response.headers.set("X-Content-Type-Options", "nosniff");
      response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
      response.headers.set(
        "Content-Security-Policy",
        "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';"
      );
      
      return response;
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*",
    "/profile/:path*",
    "/settings/:path*",
    "/api/:path*",
  ],
};