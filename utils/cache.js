const NodeCache = require('node-cache');
const mongoose = require('mongoose');
const { promisify } = require('util');
const logger = require('./logger');
const eventService = require('../services/EventService');
const DataLoader = require('dataloader');
const zlib = require('zlib');
const { performance } = require('perf_hooks');

/**
 * Cache utility for improving application performance
 * Implements in-memory caching with Redis fallback, data compression,
 * request batching, and adaptive TTL
 */

// Cache expiration times (in seconds)
const DEFAULT_TTL = 3600; // 1 hour
const TTL_SETTINGS = {
  'users': 1800,           // 30 mins 
  'invoices': 300,         // 5 mins
  'customers': 600,        // 10 mins
  'statistics': 1200,      // 20 mins
  'metadata': 86400,       // 24 hours
  'settings': 86400,       // 24 hours
  'templates': 86400       // 24 hours
};

// Compression settings
const COMPRESSION_THRESHOLD = 1024; // Only compress values larger than 1KB
const COMPRESSION_LEVEL = 6; // Medium compression level (0-9)

// Create memory cache instance with standard settings
const memoryCache = new NodeCache({
  stdTTL: DEFAULT_TTL,
  checkperiod: 120,        // Check for expired keys every 2 minutes
  useClones: false,        // Do not clone objects (improves performance)
  deleteOnExpire: true,    // Auto delete expired items
  maxKeys: 5000            // Prevent memory issues
});

// Try to load Redis client if available
let redisClient = null;
try {
  const Redis = require('ioredis');
  const config = require('../config');
  
  if (config.redis && config.redis.url) {
    redisClient = new Redis(config.redis.url, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      connectTimeout: 5000,
      keyPrefix: 'cache:'
    });
    
    // Log Redis connection status
    redisClient.on('connect', () => {
      logger.info('Redis cache connected');
    });
    
    redisClient.on('error', (err) => {
      logger.error('Redis cache error', { error: err.message });
      // Fallback to memory cache only
      if (redisClient) {
        redisClient.disconnect();
        redisClient = null;
      }
    });
  }
} catch (error) {
  logger.info('Redis not available, using memory cache only', { error: error.message });
}

// Listen for cache invalidation events
eventService.on('cache:invalidate', async (data) => {
  if (data.key) {
    await cache.del(data.key);
  } else if (data.pattern) {
    await cache.delByPattern(data.pattern);
  }
});

// Cache statistics for monitoring
const stats = {
  hits: 0,
  misses: 0,
  sets: 0,
  deletes: 0,
  errors: 0,
  compressionSavings: 0,
  batchLoadCount: 0,
  requestTime: 0,
  requestCount: 0
};

// Helper functions for compression
const compressValue = async (value) => {
  const stringValue = JSON.stringify(value);
  
  // Only compress if above threshold
  if (stringValue.length < COMPRESSION_THRESHOLD) {
    return {
      compressed: false,
      data: stringValue
    };
  }
  
  const originalSize = Buffer.from(stringValue).length;
  const compressed = await new Promise((resolve, reject) => {
    zlib.deflate(stringValue, { level: COMPRESSION_LEVEL }, (err, buffer) => {
      if (err) reject(err);
      else resolve(buffer);
    });
  });
  
  const compressedSize = compressed.length;
  stats.compressionSavings += (originalSize - compressedSize);
  
  return {
    compressed: true,
    data: compressed
  };
};

const decompressValue = async (data) => {
  if (!data.compressed) {
    return JSON.parse(data.data);
  }
  
  const decompressed = await new Promise((resolve, reject) => {
    zlib.inflate(data.data, (err, buffer) => {
      if (err) reject(err);
      else resolve(buffer);
    });
  });
  
  return JSON.parse(decompressed.toString());
};

/**
 * Main cache implementation
 */
const cache = {
  // DataLoaders for request batching (created on demand)
  loaders: {},
  
  /**
   * Get value from cache
   * @param {string} key - Cache key
   * @param {Function} [fallback] - Optional fallback function to generate value if not in cache
   * @param {Object} [options] - Cache options
   * @returns {Promise<*>} Cached value
   */
  async get(key, fallback = null, options = {}) {
    const startTime = performance.now();
    try {
      // Try memory cache first (faster)
      let value = memoryCache.get(key);
      
      if (value !== undefined) {
        stats.hits++;
        stats.requestTime += (performance.now() - startTime);
        stats.requestCount++;
        return value;
      }
      
      // Try Redis if available
      if (redisClient) {
        const redisValue = await redisClient.get(key);
        if (redisValue) {
          try {
            // Parse the JSON or decompress value from Redis
            let parsedValue;
            try {
              const data = JSON.parse(redisValue);
              if (data && typeof data === 'object' && 'compressed' in data) {
                value = await decompressValue(data);
              } else {
                value = data;
              }
            } catch (e) {
              // Legacy value (not compressed)
              value = JSON.parse(redisValue);
            }
            
            // Store in memory cache for faster subsequent access
            const ttl = options.ttl || TTL_SETTINGS[options.type] || DEFAULT_TTL;
            memoryCache.set(key, value, ttl);
            
            stats.hits++;
            stats.requestTime += (performance.now() - startTime);
            stats.requestCount++;
            return value;
          } catch (e) {
            // Handle corrupted cache data
            await redisClient.del(key);
          }
        }
      }
      
      // Cache miss - use fallback if provided
      stats.misses++;
      
      if (typeof fallback === 'function') {
        const fallbackValue = await fallback();
        
        if (fallbackValue !== undefined && fallbackValue !== null) {
          await this.set(key, fallbackValue, options);
        }
        
        stats.requestTime += (performance.now() - startTime);
        stats.requestCount++;
        return fallbackValue;
      }
      
      stats.requestTime += (performance.now() - startTime);
      stats.requestCount++;
      return null;
    } catch (error) {
      stats.errors++;
      logger.error('Cache get error', { key, error: error.message });
      
      // Return fallback value on error if available
      if (typeof fallback === 'function') {
        const fallbackValue = await fallback();
        stats.requestTime += (performance.now() - startTime);
        stats.requestCount++;
        return fallbackValue;
      }
      
      stats.requestTime += (performance.now() - startTime);
      stats.requestCount++;
      return null;
    }
  },
  
  /**
   * Store value in cache
   * @param {string} key - Cache key
   * @param {*} value - Value to cache
   * @param {Object} [options] - Cache options
   * @returns {Promise<boolean>} Success status
   */
  async set(key, value, options = {}) {
    try {
      if (value === undefined || value === null) {
        return false;
      }
      
      // Calculate adaptive TTL based on access frequency if enabled
      let ttl = options.ttl || TTL_SETTINGS[options.type] || DEFAULT_TTL;
      if (options.adaptiveTtl && stats.hits > 100) {
        // Increase TTL for frequently accessed items
        const hitRate = stats.hits / (stats.hits + stats.misses);
        if (hitRate > 0.8) {
          ttl = Math.min(ttl * 1.5, 86400); // Cap at 24 hours
        }
      }
      
      // Store in memory cache (uncompressed for speed)
      memoryCache.set(key, value, ttl);
      
      // Store in Redis if available (with compression for large values)
      if (redisClient) {
        let redisValue;
        
        if (options.compress !== false) {
          // Use compression for larger values
          const compressed = await compressValue(value);
          redisValue = JSON.stringify(compressed);
        } else {
          redisValue = JSON.stringify(value);
        }
        
        await redisClient.set(key, redisValue, 'EX', ttl);
      }
      
      stats.sets++;
      return true;
    } catch (error) {
      stats.errors++;
      logger.error('Cache set error', { key, error: error.message });
      return false;
    }
  },
  
  /**
   * Remove value from cache
   * @param {string} key - Cache key
   * @returns {Promise<boolean>} Success status
   */
  async del(key) {
    try {
      // Remove from memory cache
      memoryCache.del(key);
      
      // Remove from Redis if available
      if (redisClient) {
        await redisClient.del(key);
      }
      
      // Clear any DataLoader cache for this key
      for (const loaderKey in this.loaders) {
        if (loaderKey.startsWith(key.split(':')[0])) {
          this.loaders[loaderKey].clearAll();
        }
      }
      
      stats.deletes++;
      return true;
    } catch (error) {
      stats.errors++;
      logger.error('Cache delete error', { key, error: error.message });
      return false;
    }
  },
  
  /**
   * Delete multiple cache entries by pattern
   * @param {string} pattern - Key pattern (e.g., 'user:*')
   * @returns {Promise<number>} Number of keys deleted
   */
  async delByPattern(pattern) {
    try {
      let deletedCount = 0;
      
      // Delete from memory cache using regex
      const memKeys = memoryCache.keys();
      const regex = new RegExp(pattern.replace('*', '.*'));
      
      memKeys.forEach(key => {
        if (regex.test(key)) {
          memoryCache.del(key);
          deletedCount++;
        }
      });
      
      // Delete from Redis if available
      if (redisClient) {
        const keys = await redisClient.keys(pattern);
        if (keys.length > 0) {
          const redisDeleted = await redisClient.del(keys);
          deletedCount += redisDeleted;
        }
      }
      
      // Clear related DataLoaders
      const entityType = pattern.split(':')[0];
      if (this.loaders[entityType]) {
        this.loaders[entityType].clearAll();
      }
      
      stats.deletes += deletedCount;
      return deletedCount;
    } catch (error) {
      stats.errors++;
      logger.error('Cache pattern delete error', { pattern, error: error.message });
      return 0;
    }
  },
  
  /**
   * Clear all cache entries
   * @returns {Promise<boolean>} Success status
   */
  async flush() {
    try {
      // Clear memory cache
      memoryCache.flushAll();
      
      // Clear Redis if available
      if (redisClient) {
        await redisClient.flushdb();
      }
      
      // Clear all DataLoaders
      for (const loaderKey in this.loaders) {
        this.loaders[loaderKey].clearAll();
      }
      
      return true;
    } catch (error) {
      stats.errors++;
      logger.error('Cache flush error', { error: error.message });
      return false;
    }
  },
  
  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getStats() {
    return {
      ...stats,
      memoryItems: memoryCache.keys().length,
      memoryStats: memoryCache.getStats(),
      redisAvailable: !!redisClient,
      hitRate: stats.hits / (stats.hits + stats.misses || 1),
      averageResponseTime: stats.requestCount ? (stats.requestTime / stats.requestCount).toFixed(2) + 'ms' : '0ms',
      compressionSavingsKB: (stats.compressionSavings / 1024).toFixed(2),
      batchEfficiency: stats.requestCount ? (stats.batchLoadCount / stats.requestCount).toFixed(2) : '0'
    };
  },
  
  /**
   * Helper for generating consistent cache keys
   * @param {string} prefix - Key prefix (typically entity name)
   * @param {string|number} id - Entity identifier
   * @param {Object} [params] - Additional parameters to include in key
   * @returns {string} Formatted cache key
   */
  formatKey(prefix, id, params = {}) {
    let key = `${prefix}:${id}`;
    
    if (Object.keys(params).length > 0) {
      const paramString = Object.entries(params)
        .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
        .map(([k, v]) => `${k}=${v}`)
        .join('&');
      
      key += `:${paramString}`;
    }
    
    return key;
  },
  
  /**
   * Get a DataLoader for batch loading items
   * @param {string} type - Entity type
   * @param {Function} batchFn - Batch loading function
   * @param {Object} [options] - DataLoader options
   * @returns {DataLoader} DataLoader instance
   */
  getLoader(type, batchFn, options = {}) {
    if (!this.loaders[type]) {
      this.loaders[type] = new DataLoader(
        async (keys) => {
          stats.batchLoadCount++;
          return batchFn(keys);
        }, 
        {
          cache: true,
          maxBatchSize: 100,
          ...options
        }
      );
    }
    
    return this.loaders[type];
  },
  
  /**
   * Prefetch items into cache
   * @param {string} type - Entity type
   * @param {Array} ids - IDs to prefetch
   * @param {Function} fetchFn - Function to fetch items by IDs
   * @param {Object} [options] - Cache options
   * @returns {Promise<void>}
   */
  async prefetch(type, ids, fetchFn, options = {}) {
    try {
      const uniqueIds = [...new Set(ids)];
      const items = await fetchFn(uniqueIds);
      
      // Cache individual items
      for (const item of items) {
        if (item && item.id) {
          const key = this.formatKey(type, item.id);
          await this.set(key, item, { type, ...options });
        }
      }
      
      return true;
    } catch (error) {
      logger.error('Cache prefetch error', { type, error: error.message });
      return false;
    }
  }
};

module.exports = cache; 