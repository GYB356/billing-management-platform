import { NextRequest } from 'next/server';

interface RateLimitInfo {
  timestamp: number;
  count: number;
}

const rateLimitMap = new Map<string, RateLimitInfo>();

export const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
export const MAX_REQUESTS = 30; // 30 requests per minute

export function getRateLimitInfo(identifier: string): RateLimitInfo {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW;
  
  // Clean up old entries
  for (const [key, info] of rateLimitMap.entries()) {
    if (info.timestamp < windowStart) {
      rateLimitMap.delete(key);
    }
  }
  
  const current = rateLimitMap.get(identifier);
  if (!current || current.timestamp < windowStart) {
    return { timestamp: now, count: 0 };
  }
  return current;
}

export function isRateLimited(req: NextRequest): boolean {
  const identifier = req.ip || 'unknown';
  const info = getRateLimitInfo(identifier);
  
  if (info.count >= MAX_REQUESTS) {
    return true;
  }
  
  rateLimitMap.set(identifier, {
    timestamp: info.timestamp,
    count: info.count + 1
  });
  
  return false;
} 