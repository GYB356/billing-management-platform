import Redis from 'ioredis';
import { Logger } from '../utils/logging';
import { MLModel } from '../types/ml';
import { gzip, unzip } from 'zlib';
import { promisify } from 'util';

const gzipAsync = promisify(gzip);
const unzipAsync = promisify(unzip);

/**
 * Service for caching ML models using Redis
 * Provides compression and batch operations for efficient storage and retrieval
 */
export class CacheService {
  private redis: Redis;
  private logger: Logger;
  private readonly DEFAULT_TTL = 3600; // 1 hour
  private readonly COMPRESSION_THRESHOLD = 1024; // 1KB

  /**
   * Initialize the cache service with Redis connection
   * @throws {ConfigurationError} If Redis connection fails
   */
  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      retryStrategy: (times) => Math.min(times * 50, 2000)
    });

    this.logger = new Logger({
      appName: 'CacheService',
      logLevel: 'info'
    });

    this.redis.on('error', (error) => {
      this.logger.error('Redis connection error', { error });
    });
  }

  /**
   * Cache an ML model with optional TTL
   * @param key - Unique identifier for the model
   * @param model - ML model to cache
   * @param ttl - Time to live in seconds (default: 1 hour)
   * @throws {Error} If caching fails
   */
  async cacheMLModel(key: string, model: MLModel, ttl: number = this.DEFAULT_TTL): Promise<void> {
    try {
      const serializedModel = JSON.stringify(model);
      const value = await this.compressIfNeeded(serializedModel);
      await this.redis.setex(this.getModelKey(key), ttl, value);
      this.logger.info('ML model cached successfully', { key });
    } catch (error) {
      this.logger.error('Failed to cache ML model', { error, key });
      throw error;
    }
  }

  /**
   * Retrieve a cached ML model
   * @param key - Unique identifier for the model
   * @returns The cached model or null if not found
   */
  async getCachedMLModel(key: string): Promise<MLModel | null> {
    try {
      const cachedModel = await this.redis.get(this.getModelKey(key));
      if (!cachedModel) {
        return null;
      }
      const decompressedModel = await this.decompressIfNeeded(cachedModel);
      return JSON.parse(decompressedModel);
    } catch (error) {
      this.logger.error('Failed to retrieve cached ML model', { error, key });
      return null;
    }
  }

  /**
   * Cache multiple ML models in a single operation
   * @param models - Array of models with their keys and optional TTLs
   * @throws {Error} If batch caching fails
   */
  async batchCacheMLModels(models: Array<{ key: string; model: MLModel; ttl?: number }>): Promise<void> {
    try {
      const pipeline = this.redis.pipeline();
      
      for (const { key, model, ttl } of models) {
        const serializedModel = JSON.stringify(model);
        const value = await this.compressIfNeeded(serializedModel);
        pipeline.setex(this.getModelKey(key), ttl || this.DEFAULT_TTL, value);
      }

      await pipeline.exec();
      this.logger.info('Batch ML models cached successfully', { count: models.length });
    } catch (error) {
      this.logger.error('Failed to batch cache ML models', { error });
      throw error;
    }
  }

  /**
   * Retrieve multiple ML models in a single operation
   * @param keys - Array of model keys to retrieve
   * @returns Array of models (null for any models not found)
   */
  async batchGetMLModels(keys: string[]): Promise<Array<MLModel | null>> {
    try {
      const pipeline = this.redis.pipeline();
      keys.forEach(key => pipeline.get(this.getModelKey(key)));
      
      const results = await pipeline.exec();
      if (!results) return Array(keys.length).fill(null);

      return await Promise.all(
        results.map(async ([err, value]) => {
          if (err || !value) return null;
          const decompressedValue = await this.decompressIfNeeded(value as string);
          return JSON.parse(decompressedValue);
        })
      );
    } catch (error) {
      this.logger.error('Failed to batch retrieve ML models', { error });
      return Array(keys.length).fill(null);
    }
  }

  /**
   * Invalidate a cached ML model
   * @param key - Key of the model to invalidate
   * @throws {Error} If invalidation fails
   */
  async invalidateMLModel(key: string): Promise<void> {
    try {
      await this.redis.del(this.getModelKey(key));
      this.logger.info('ML model cache invalidated', { key });
    } catch (error) {
      this.logger.error('Failed to invalidate ML model cache', { error, key });
      throw error;
    }
  }

  /**
   * Invalidate multiple ML models in a single operation
   * @param keys - Array of model keys to invalidate
   * @throws {Error} If batch invalidation fails
   */
  async batchInvalidateMLModels(keys: string[]): Promise<void> {
    try {
      const pipeline = this.redis.pipeline();
      keys.forEach(key => pipeline.del(this.getModelKey(key)));
      await pipeline.exec();
      this.logger.info('Batch ML models invalidated', { count: keys.length });
    } catch (error) {
      this.logger.error('Failed to batch invalidate ML models', { error });
      throw error;
    }
  }

  /**
   * Generate Redis key for a model
   * @param key - Base key
   * @returns Prefixed Redis key
   */
  private getModelKey(key: string): string {
    return `ml_model:${key}`;
  }

  /**
   * Compress data if it exceeds threshold
   * @param data - Data to potentially compress
   * @returns Compressed or original data
   */
  private async compressIfNeeded(data: string): Promise<string> {
    if (data.length < this.COMPRESSION_THRESHOLD) {
      return data;
    }
    const compressed = await gzipAsync(Buffer.from(data));
    return `gz:${compressed.toString('base64')}`;
  }

  /**
   * Decompress data if it was compressed
   * @param data - Data to potentially decompress
   * @returns Decompressed or original data
   */
  private async decompressIfNeeded(data: string): Promise<string> {
    if (!data.startsWith('gz:')) {
      return data;
    }
    const compressed = Buffer.from(data.slice(3), 'base64');
    const decompressed = await unzipAsync(compressed);
    return decompressed.toString();
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    await this.redis.quit();
  }
} 