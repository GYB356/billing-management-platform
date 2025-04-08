import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

interface RateLimitConfig {
  limit: number;      // Number of requests allowed
  window: number;     // Time window in seconds
  identifier?: string; // Optional identifier for the rate limit (defaults to IP)
}

const DEFAULT_CONFIG: RateLimitConfig = {
  limit: 100,
  window: 60, // 1 minute
};

export async function rateLimitMiddleware(
  request: NextRequest,
  config: RateLimitConfig = DEFAULT_CONFIG
) {
  // Skip rate limiting for certain paths
  if (request.nextUrl.pathname.startsWith('/api/webhook')) {
    return NextResponse.next();
  }

  const identifier = config.identifier || request.ip || 'anonymous';
  const key = `rate-limit:${identifier}`;

  try {
    const current = await redis.incr(key);
    
    if (current === 1) {
      await redis.expire(key, config.window);
    }

    const remaining = Math.max(0, config.limit - current);
    const reset = await redis.ttl(key);

    // Add rate limit headers
    const response = NextResponse.next();
    response.headers.set('X-RateLimit-Limit', config.limit.toString());
    response.headers.set('X-RateLimit-Remaining', remaining.toString());
    response.headers.set('X-RateLimit-Reset', reset.toString());

    if (current > config.limit) {
      return new NextResponse(
        JSON.stringify({
          error: 'Too many requests',
          message: 'Rate limit exceeded',
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': reset.toString(),
          },
        }
      );
    }

    return response;
  } catch (error) {
    console.error('Rate limit error:', error);
    // On Redis error, allow the request but log the error
    return NextResponse.next();
  }
} 