const Redis = require('ioredis');
const logger = require('../utils/logger');

const redis = new Redis(process.env.REDIS_URL);

// Helper to generate cache key
const generateKey = (req) => {
  const path = req.path;
  const query = JSON.stringify(req.query);
  return `api:${path}:${query}`;
};

exports.cacheMiddleware = (duration = 300) => { // Default 5 minutes
  return async (req, res, next) => {
    if (req.method !== 'GET') {
      return next();
    }

    const key = generateKey(req);

    try {
      const cachedData = await redis.get(key);
      
      if (cachedData) {
        logger.debug(`Cache hit for ${key}`);
        return res.json(JSON.parse(cachedData));
      }

      // Store original send
      const originalSend = res.json;

      // Override send
      res.json = function(body) {
        // Store in cache
        redis.setex(key, duration, JSON.stringify(body))
          .catch(err => logger.error('Cache storage error:', err));

        // Restore original send
        return originalSend.call(this, body);
      };

      next();
    } catch (error) {
      logger.error('Cache error:', error);
      next();
    }
  };
};

// Clear cache when data changes
exports.clearCache = async (pattern) => {
  try {
    const keys = await redis.keys(`api:${pattern}*`);
    if (keys.length) {
      await redis.del(keys);
      logger.debug(`Cleared cache for pattern: ${pattern}`);
    }
  } catch (error) {
    logger.error('Cache clearing error:', error);
  }
};