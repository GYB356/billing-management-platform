import { NextRequest } from 'next/server';

// Simple in-memory store for rate limiting
const store = new Map<string, { count: number; timestamp: number }>();

const RATE_LIMIT_REQUESTS = 100; // Number of requests
const RATE_LIMIT_WINDOW = 60 * 1000; // Time window in milliseconds

export async function rateLimit(request: NextRequest): Promise<void> {
  if (process.env.NODE_ENV === 'development') {
    return; // Skip rate limiting in development
  }

  const ip = request.ip || 'anonymous';
  const now = Date.now();

  // Clean up old entries
  const keys = Array.from(store.keys());
  keys.forEach(key => {
    const value = store.get(key);
    if (value && now - value.timestamp > RATE_LIMIT_WINDOW) {
      store.delete(key);
    }
  });

  const current = store.get(ip);
  if (!current) {
    store.set(ip, { count: 1, timestamp: now });
    return;
  }

  if (now - current.timestamp > RATE_LIMIT_WINDOW) {
    store.set(ip, { count: 1, timestamp: now });
    return;
  }

  current.count++;
  if (current.count > RATE_LIMIT_REQUESTS) {
    throw new Error('Too many requests');
  }
}