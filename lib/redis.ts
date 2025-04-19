import { Redis } from '@upstash/redis';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';

// Cache for the Redis client instance
let redisClient: Redis | null = null;

/**
 * Creates or returns an existing Redis client
 */
export function createRedisInstance(): Redis | null {
  // Return existing instance if already created
  if (redisClient) {
    return redisClient;
  }

  // Skip if Redis URL is not configured
  if (!env.REDIS_URL) {
    return null;
  }

  try {
    redisClient = new Redis({
      url: env.REDIS_URL,
      retry: {
        retries: 3,
        backoff: (retryCount) => Math.min(retryCount * 50, 1000),
      },
    });

    logger.info('Redis client initialized');
    return redisClient;
  } catch (error) {
    logger.error('Failed to initialize Redis client', { error });
    return null;
  }
}

/**
 * Cache a value with Redis
 */
export async function cacheSet(
  key: string,
  value: any,
  ttlSeconds: number = env.CACHE_TTL
): Promise<boolean> {
  const redis = createRedisInstance();
  if (!redis) return false;

  try {
    const serializedValue = JSON.stringify(value);
    await redis.set(key, serializedValue, { ex: ttlSeconds });
    return true;
  } catch (error) {
    logger.error('Redis cache set error', { key, error });
    return false;
  }
}

/**
 * Get a cached value from Redis
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  const redis = createRedisInstance();
  if (!redis) return null;

  try {
    const value = await redis.get(key);
    if (!value) return null;
    
    return JSON.parse(value as string) as T;
  } catch (error) {
    logger.error('Redis cache get error', { key, error });
    return null;
  }
}

/**
 * Delete a cached value from Redis
 */
export async function cacheDelete(key: string): Promise<boolean> {
  const redis = createRedisInstance();
  if (!redis) return false;

  try {
    await redis.del(key);
    return true;
  } catch (error) {
    logger.error('Redis cache delete error', { key, error });
    return false;
  }
}

/**
 * Delete multiple cached values by pattern
 */
export async function cacheDeletePattern(pattern: string): Promise<number> {
  const redis = createRedisInstance();
  if (!redis) return 0;

  try {
    const keys = await redis.keys(pattern);
    if (keys.length === 0) return 0;
    
    const deleted = await redis.del(keys);
    return deleted;
  } catch (error) {
    logger.error('Redis cache pattern delete error', { pattern, error });
    return 0;
  }
}

/**
 * Cache wrapper for any async function
 * Will return cached value if available, otherwise call function and cache result
 */
export async function withCache<T>(
  key: string,
  fn: () => Promise<T>,
  ttlSeconds: number = env.CACHE_TTL
): Promise<T> {
  // Try to get from cache first
  const cached = await cacheGet<T>(key);
  if (cached !== null) {
    return cached;
  }

  // Call the function and cache the result
  const result = await fn();
  await cacheSet(key, result, ttlSeconds);
  return result;
} 