import { prisma } from '@/lib/prisma';
import { RedisClient } from '../redis';
import { createEvent } from '../events';

interface RateLimitConfig {
  identifier: string;
  limit: number;
  window: number; // in seconds
  cost?: number;
}

interface QuotaConfig {
  identifier: string;
  limit: number;
  period: 'daily' | 'monthly' | 'yearly';
  scope?: string;
}

export class RateLimiterService {
  private readonly redis: RedisClient;

  constructor() {
    this.redis = new RedisClient();
  }

  /**
   * Check rate limit
   */
  public async checkRateLimit(config: RateLimitConfig): Promise<boolean> {
    const { identifier, limit, window, cost = 1 } = config;
    const key = `ratelimit:${identifier}`;
    const now = Date.now();
    const windowStart = now - (window * 1000);

    // Remove old entries and get current count
    const multi = this.redis.multi();
    multi.zremrangebyscore(key, 0, windowStart);
    multi.zcard(key);
    const [, count] = await multi.exec();

    if ((count as number) + cost > limit) {
      await this.handleRateLimitExceeded(config);
      return false;
    }

    // Add new entry
    await this.redis.zadd(key, now, `${now}-${Math.random()}`);
    await this.redis.expire(key, window);
    return true;
  }

  /**
   * Check quota
   */
  public async checkQuota(config: QuotaConfig): Promise<boolean> {
    const { identifier, limit, period, scope = 'default' } = config;
    const key = `quota:${identifier}:${scope}:${period}`;
    const count = await this.redis.get(key);

    if (!count) {
      // Initialize quota
      await this.initializeQuota(config);
      return true;
    }

    if (parseInt(count) >= limit) {
      await this.handleQuotaExceeded(config);
      return false;
    }

    await this.redis.incr(key);
    return true;
  }

  /**
   * Initialize quota
   */
  private async initializeQuota(config: QuotaConfig) {
    const { identifier, period, scope = 'default' } = config;
    const key = `quota:${identifier}:${scope}:${period}`;
    const ttl = this.getQuotaPeriodTTL(period);

    await this.redis.setex(key, ttl, '1');
  }

  /**
   * Get TTL for quota period
   */
  private getQuotaPeriodTTL(period: string): number {
    const now = new Date();
    let expiryDate = new Date(now);

    switch (period) {
      case 'daily':
        expiryDate.setDate(now.getDate() + 1);
        expiryDate.setHours(0, 0, 0, 0);
        break;
      case 'monthly':
        expiryDate.setMonth(now.getMonth() + 1, 1);
        expiryDate.setHours(0, 0, 0, 0);
        break;
      case 'yearly':
        expiryDate.setFullYear(now.getFullYear() + 1, 0, 1);
        expiryDate.setHours(0, 0, 0, 0);
        break;
      default:
        throw new Error(`Invalid quota period: ${period}`);
    }

    return Math.floor((expiryDate.getTime() - now.getTime()) / 1000);
  }

  /**
   * Handle rate limit exceeded
   */
  private async handleRateLimitExceeded(config: RateLimitConfig) {
    const { identifier } = config;

    // Log rate limit event
    await prisma.rateLimitEvent.create({
      data: {
        identifier,
        timestamp: new Date(),
        type: 'RATE_LIMIT_EXCEEDED'
      }
    });

    // Create system event
    await createEvent({
      type: 'RATE_LIMIT_EXCEEDED',
      resourceType: 'API',
      resourceId: identifier,
      severity: 'WARNING',
      metadata: {
        limit: config.limit,
        window: config.window
      }
    });
  }

  /**
   * Handle quota exceeded
   */
  private async handleQuotaExceeded(config: QuotaConfig) {
    const { identifier, scope } = config;

    // Log quota event
    await prisma.quotaEvent.create({
      data: {
        identifier,
        scope,
        timestamp: new Date(),
        type: 'QUOTA_EXCEEDED'
      }
    });

    // Create system event
    await createEvent({
      type: 'QUOTA_EXCEEDED',
      resourceType: 'API',
      resourceId: identifier,
      severity: 'WARNING',
      metadata: {
        scope,
        limit: config.limit,
        period: config.period
      }
    });
  }

  /**
   * Get rate limit status
   */
  public async getRateLimitStatus(identifier: string): Promise<{
    remaining: number;
    reset: number;
  }> {
    const key = `ratelimit:${identifier}`;
    const now = Date.now();

    // Get current count and window end
    const entries = await this.redis.zrangebyscore(key, now - 3600000, now);
    const ttl = await this.redis.ttl(key);

    return {
      remaining: Math.max(0, entries.length),
      reset: Math.max(0, ttl)
    };
  }

  /**
   * Get quota status
   */
  public async getQuotaStatus(
    identifier: string,
    period: string,
    scope: string = 'default'
  ): Promise<{
    remaining: number;
    reset: number;
  }> {
    const key = `quota:${identifier}:${scope}:${period}`;
    const [count, ttl] = await Promise.all([
      this.redis.get(key),
      this.redis.ttl(key)
    ]);

    return {
      remaining: count ? parseInt(count) : 0,
      reset: Math.max(0, ttl)
    };
  }

  /**
   * Reset rate limit
   */
  public async resetRateLimit(identifier: string): Promise<void> {
    const key = `ratelimit:${identifier}`;
    await this.redis.del(key);
  }

  /**
   * Reset quota
   */
  public async resetQuota(
    identifier: string,
    period: string,
    scope: string = 'default'
  ): Promise<void> {
    const key = `quota:${identifier}:${scope}:${period}`;
    await this.redis.del(key);
  }

  /**
   * Get rate limit metrics
   */
  public async getRateLimitMetrics(
    startTime: Date,
    endTime: Date
  ): Promise<{
    totalExceeded: number;
    byIdentifier: Record<string, number>;
  }> {
    const events = await prisma.rateLimitEvent.findMany({
      where: {
        timestamp: {
          gte: startTime,
          lte: endTime
        }
      }
    });

    const byIdentifier = events.reduce((acc, event) => {
      acc[event.identifier] = (acc[event.identifier] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalExceeded: events.length,
      byIdentifier
    };
  }

  /**
   * Get quota metrics
   */
  public async getQuotaMetrics(
    startTime: Date,
    endTime: Date
  ): Promise<{
    totalExceeded: number;
    byIdentifier: Record<string, number>;
    byScope: Record<string, number>;
  }> {
    const events = await prisma.quotaEvent.findMany({
      where: {
        timestamp: {
          gte: startTime,
          lte: endTime
        }
      }
    });

    const metrics = {
      totalExceeded: events.length,
      byIdentifier: {} as Record<string, number>,
      byScope: {} as Record<string, number>
    };

    events.forEach(event => {
      metrics.byIdentifier[event.identifier] =
        (metrics.byIdentifier[event.identifier] || 0) + 1;
      metrics.byScope[event.scope] = (metrics.byScope[event.scope] || 0) + 1;
    });

    return metrics;
  }

  /**
   * Apply rate limiting middleware
   */
  public createRateLimitMiddleware(config: RateLimitConfig) {
    return async (req: any, res: any, next: any) => {
      const allowed = await this.checkRateLimit(config);

      if (!allowed) {
        const status = await this.getRateLimitStatus(config.identifier);
        res.setHeader('X-RateLimit-Remaining', status.remaining);
        res.setHeader('X-RateLimit-Reset', status.reset);
        res.status(429).json({
          error: 'Rate limit exceeded',
          retryAfter: status.reset
        });
        return;
      }

      next();
    };
  }

  /**
   * Apply quota middleware
   */
  public createQuotaMiddleware(config: QuotaConfig) {
    return async (req: any, res: any, next: any) => {
      const allowed = await this.checkQuota(config);

      if (!allowed) {
        const status = await this.getQuotaStatus(
          config.identifier,
          config.period,
          config.scope
        );
        res.setHeader('X-Quota-Remaining', status.remaining);
        res.setHeader('X-Quota-Reset', status.reset);
        res.status(429).json({
          error: 'Quota exceeded',
          retryAfter: status.reset
        });
        return;
      }

      next();
    };
  }
}