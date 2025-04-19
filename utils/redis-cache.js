/**
 * Redis-based caching utility for improved application performance
 */
const Redis = require('ioredis');
const { redisConfig } = require('../config/database');

class RedisCache {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.defaultTTL = 3600; // Default TTL: 1 hour
    this.initialize();
  }

  // Initialize Redis connection
  initialize() {
    try {
      this.client = new Redis({
        host: redisConfig.host || 'localhost',
        port: redisConfig.port || 6379,
        password: redisConfig.password,
        username: redisConfig.username,
        db: redisConfig.db || 0,
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        maxRetriesPerRequest: 3,
      });

      this.client.on('connect', () => {
        this.isConnected = true;
        console.log('Redis cache connected');
      });

      this.client.on('error', (err) => {
        this.isConnected = false;
        console.error('Redis cache error:', err);
      });

      this.client.on('end', () => {
        this.isConnected = false;
        console.log('Redis cache disconnected');
      });
    } catch (error) {
      console.error('Redis cache initialization failed:', error);
      this.isConnected = false;
    }
  }

  // Get value from cache
  async get(key) {
    if (!this.isConnected || !this.client) {
      return null;
    }

    try {
      const data = await this.client.get(key);
      if (!data) return null;

      return JSON.parse(data);
    } catch (error) {
      console.error(`Error getting cache key ${key}:`, error);
      return null;
    }
  }

  // Set value in cache with optional TTL
  async set(key, value, ttl = this.defaultTTL) {
    if (!this.isConnected || !this.client) {
      return false;
    }

    try {
      const serialized = JSON.stringify(value);
      
      if (ttl) {
        await this.client.setex(key, ttl, serialized);
      } else {
        await this.client.set(key, serialized);
      }
      
      return true;
    } catch (error) {
      console.error(`Error setting cache key ${key}:`, error);
      return false;
    }
  }

  // Delete a specific key from cache
  async delete(key) {
    if (!this.isConnected || !this.client) {
      return false;
    }

    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      console.error(`Error deleting cache key ${key}:`, error);
      return false;
    }
  }

  // Delete multiple keys matching a pattern
  async deletePattern(pattern) {
    if (!this.isConnected || !this.client) {
      return false;
    }

    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
      return true;
    } catch (error) {
      console.error(`Error deleting cache pattern ${pattern}:`, error);
      return false;
    }
  }

  // Clear entire cache
  async clear() {
    if (!this.isConnected || !this.client) {
      return false;
    }

    try {
      await this.client.flushdb();
      return true;
    } catch (error) {
      console.error('Error clearing cache:', error);
      return false;
    }
  }

  // Get cache statistics
  async getStats() {
    if (!this.isConnected || !this.client) {
      return null;
    }

    try {
      const info = await this.client.info();
      const dbSize = await this.client.dbsize();
      
      return {
        dbSize,
        info: this.parseRedisInfo(info),
        status: 'connected'
      };
    } catch (error) {
      console.error('Error getting cache stats:', error);
      return {
        status: 'error',
        error: error.message
      };
    }
  }

  // Helper method to parse Redis INFO command output
  parseRedisInfo(info) {
    const result = {};
    const lines = info.split('\r\n');
    
    lines.forEach(line => {
      if (line && !line.startsWith('#')) {
        const parts = line.split(':');
        if (parts.length === 2) {
          result[parts[0]] = parts[1];
        }
      }
    });
    
    return result;
  }

  // Cache middleware for Express routes
  middleware(ttl = this.defaultTTL) {
    return async (req, res, next) => {
      if (!this.isConnected || !this.client) {
        return next();
      }

      // Skip caching for non-GET requests or if Cache-Control: no-cache is set
      if (req.method !== 'GET' || req.headers['cache-control'] === 'no-cache') {
        return next();
      }

      const key = `cache:${req.originalUrl}`;

      try {
        const cachedData = await this.get(key);
        
        if (cachedData) {
          return res.json(cachedData);
        }

        // Store the original res.json method
        const originalJson = res.json;
        
        // Override res.json method
        res.json = function(data) {
          // Restore original method
          res.json = originalJson;
          
          // Cache the response data
          this.set(key, data, ttl);
          
          // Call the original method
          return originalJson.call(this, data);
        }.bind(this);
        
        next();
      } catch (error) {
        console.error('Cache middleware error:', error);
        next();
      }
    };
  }

  // Close Redis connection
  async close() {
    if (this.client) {
      await this.client.quit();
      this.isConnected = false;
      this.client = null;
    }
  }
}

// Export singleton instance
module.exports = new RedisCache(); 