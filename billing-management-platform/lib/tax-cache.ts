import redis from "./redis";
import { getTaxRateForUser } from "./tax";

const TAX_RATE_CACHE_TTL = 60 * 60 * 24; // 24 hours in seconds
const TAX_RATE_CACHE_PREFIX = "tax:rate:";

interface CachedTaxRate {
  rate: number;
  cachedAt: number;
}

export async function getCachedTaxRate(country: string, region?: string): Promise<number> {
  try {
    const key = `${TAX_RATE_CACHE_PREFIX}${country}:${region || "default"}`;
    
    // Try to get from cache
    const cached = await redis.get(key);
    if (cached) {
      const parsedCache = JSON.parse(cached) as CachedTaxRate;
      
      // Return cached value if it exists
      return parsedCache.rate;
    }

    // If not in cache, fetch from database
    const rate = await getTaxRateForUser("system", country, region);
    
    // Cache the new value with metadata
    const cacheValue: CachedTaxRate = {
      rate,
      cachedAt: Date.now(),
    };
    
    await redis.set(
      key,
      JSON.stringify(cacheValue),
      'EX',
      TAX_RATE_CACHE_TTL
    );

    return rate;
  } catch (error) {
    console.error('Error in getCachedTaxRate:', error);
    
    // Fallback to direct database lookup in case of cache failure
    return getTaxRateForUser("system", country, region);
  }
}

export async function invalidateTaxRateCache(country: string, region?: string): Promise<void> {
  try {
    const key = `${TAX_RATE_CACHE_PREFIX}${country}:${region || "default"}`;
    await redis.del(key);
  } catch (error) {
    console.error('Error invalidating tax rate cache:', error);
  }
}

export async function invalidateAllTaxRateCache(): Promise<void> {
  try {
    const keys = await redis.keys(`${TAX_RATE_CACHE_PREFIX}*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (error) {
    console.error('Error invalidating all tax rate cache:', error);
  }
} 