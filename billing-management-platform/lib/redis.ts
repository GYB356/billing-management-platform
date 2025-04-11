import { Redis } from 'ioredis';

// Initialize Redis client with fallback to environment variables
const redis = new Redis(process.env.REDIS_URL || {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
});

// Add error handling
redis.on('error', (error) => {
  console.error('Redis connection error:', error);
});

export default redis; 