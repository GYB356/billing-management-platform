import prisma from '@/lib/prisma';
import { TaxRate } from '@/types/tax';
import { createEvent, EventType } from '@/lib/events';

interface CachedTaxRate extends TaxRate {
  cachedAt: number;
}

export class TaxRateCache {
  private static instance: TaxRateCache;
  private cache: Map<string, CachedTaxRate>;
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

  private constructor() {
    this.cache = new Map();
  }

  public static getInstance(): TaxRateCache {
    if (!TaxRateCache.instance) {
      TaxRateCache.instance = new TaxRateCache();
    }
    return TaxRateCache.instance;
  }

  /**
   * Get tax rate from cache or database
   */
  public async getTaxRate(id: string): Promise<TaxRate | null> {
    // Check cache first
    const cached = this.cache.get(id);
    if (cached && !this.isExpired(cached)) {
      return cached;
    }

    // If not in cache or expired, fetch from database
    const taxRate = await prisma.taxRate.findUnique({
      where: { id }
    });

    if (taxRate) {
      this.cache.set(id, {
        ...taxRate,
        cachedAt: Date.now()
      });
    }

    return taxRate;
  }

  /**
   * Get tax rates by location
   */
  public async getTaxRatesByLocation(
    country: string,
    state?: string | null
  ): Promise<TaxRate[]> {
    const cacheKey = this.getLocationCacheKey(country, state);
    const cached = this.cache.get(cacheKey);

    if (cached && !this.isExpired(cached)) {
      return [cached];
    }

    const taxRates = await prisma.taxRate.findMany({
      where: {
        country,
        state: state || null,
        isActive: true
      }
    });

    // Cache each tax rate individually
    taxRates.forEach(rate => {
      this.cache.set(rate.id, {
        ...rate,
        cachedAt: Date.now()
      });
    });

    return taxRates;
  }

  /**
   * Invalidate cache for a specific tax rate
   */
  public invalidate(id: string): void {
    this.cache.delete(id);
  }

  /**
   * Invalidate all cached tax rates
   */
  public invalidateAll(): void {
    this.cache.clear();
    createEvent({
      eventType: EventType.TAX_RATE_CACHE_CLEARED,
      resourceType: 'TAX_RATE_CACHE',
      resourceId: 'global', // Using 'global' as the resource ID for cache-wide operations
      metadata: {
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Remove expired entries from cache
   */
  public cleanup(): void {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (this.isExpired(value)) {
        this.cache.delete(key);
      }
    }
  }

  private isExpired(cached: CachedTaxRate): boolean {
    return Date.now() - cached.cachedAt > this.CACHE_TTL;
  }

  private getLocationCacheKey(country: string, state?: string | null): string {
    return `${country}${state ? `-${state}` : ''}`;
  }
}