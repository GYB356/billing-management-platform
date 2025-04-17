import Redis from 'ioredis';
import { logger } from '../config/logging';

class Cache {
  private client: Redis;
  private defaultTTL: number;

  constructor() {
    this.client = new Redis(process.env.REDIS_URL as string, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    this.defaultTTL = parseInt(process.env.CACHE_TTL || '3600');

    this.client.on('error', (error) => {
      logger.error('Redis connection error:', error);
    });

    this.client.on('connect', () => {
      logger.info('Redis connected successfully');
    });
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error('Redis get error:', error);
      return null;
    }
  }

  async set(key: string, value: any, ttl?: number): Promise<boolean> {
    try {
      const serializedValue = JSON.stringify(value);
      if (ttl) {
        await this.client.setex(key, ttl, serializedValue);
      } else {
        await this.client.setex(key, this.defaultTTL, serializedValue);
      }
      return true;
    } catch (error) {
      logger.error('Redis set error:', error);
      return false;
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      logger.error('Redis delete error:', error);
      return false;
    }
  }

  async flush(): Promise<boolean> {
    try {
      await this.client.flushall();
      return true;
    } catch (error) {
      logger.error('Redis flush error:', error);
      return false;
    }
  }
}

export const cache = new Cache(); 