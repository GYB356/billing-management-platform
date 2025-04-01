import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';
import { NextRequest } from 'next/server';
import { ApiError } from '@/lib/api/security';

// Initialize Redis client
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Rate limit configurations
const RATE_LIMITS = {
  // Auth endpoints
  login: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, '5 m'), // 5 attempts per 5 minutes
    analytics: true,
    prefix: 'rate-limit:login',
  }),
  register: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(3, '1 h'), // 3 attempts per hour
    analytics: true,
    prefix: 'rate-limit:register',
  }),
  passwordReset: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(3, '1 h'), // 3 attempts per hour
    analytics: true,
    prefix: 'rate-limit:password-reset',
  }),
  // API endpoints
  api: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(100, '1 m'), // 100 requests per minute
    analytics: true,
    prefix: 'rate-limit:api',
  }),
  // Admin endpoints
  admin: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(50, '1 m'), // 50 requests per minute
    analytics: true,
    prefix: 'rate-limit:admin',
  }),
};

// IP blocking configuration
const IP_BLOCK_DURATION = 24 * 60 * 60; // 24 hours in seconds
const MAX_FAILED_ATTEMPTS = 10;

export async function checkRateLimit(
  req: NextRequest,
  type: keyof typeof RATE_LIMITS
): Promise<void> {
  const ip = req.ip ?? '127.0.0.1';
  const { success, limit, reset, remaining } = await RATE_LIMITS[type].limit(ip);

  if (!success) {
    throw new ApiError(429, 'Too Many Requests', 'RATE_LIMIT_EXCEEDED');
  }

  // Add rate limit headers
  req.headers.set('X-RateLimit-Limit', limit.toString());
  req.headers.set('X-RateLimit-Remaining', remaining.toString());
  req.headers.set('X-RateLimit-Reset', reset.toString());
}

export async function trackFailedAttempt(ip: string): Promise<void> {
  const key = `failed-attempts:${ip}`;
  const attempts = await redis.incr(key);
  
  if (attempts === 1) {
    await redis.expire(key, IP_BLOCK_DURATION);
  }

  if (attempts >= MAX_FAILED_ATTEMPTS) {
    await redis.set(`blocked:${ip}`, '1', { ex: IP_BLOCK_DURATION });
  }
}

export async function isIPBlocked(ip: string): Promise<boolean> {
  const blocked = await redis.get(`blocked:${ip}`);
  return !!blocked;
}

export async function resetFailedAttempts(ip: string): Promise<void> {
  await redis.del(`failed-attempts:${ip}`);
  await redis.del(`blocked:${ip}`);
}

// Rate limit middleware
export async function requireRateLimit(
  req: NextRequest,
  type: keyof typeof RATE_LIMITS
): Promise<void> {
  const ip = req.ip ?? '127.0.0.1';

  // Check if IP is blocked
  if (await isIPBlocked(ip)) {
    throw new ApiError(403, 'IP address is blocked', 'IP_BLOCKED');
  }

  // Check rate limit
  await checkRateLimit(req, type);
}

// Rate limit decorator for API routes
export function withRateLimit(type: keyof typeof RATE_LIMITS) {
  return async function rateLimitMiddleware(
    req: NextRequest,
    handler: (req: NextRequest) => Promise<Response>
  ): Promise<Response> {
    await requireRateLimit(req, type);
    return handler(req);
  };
} 