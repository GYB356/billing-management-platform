const { authLimiter, apiLimiter } = require('../../ratelimiter');
const config = require('../../config');

// Mock the express-rate-limit module
jest.mock('express-rate-limit', () => {
  return jest.fn().mockImplementation((options) => {
    return {
      options,
      // Mock the middleware function
      handler: (req, res, next) => next()
    };
  });
});

describe('Rate Limiter', () => {
  describe('authLimiter', () => {
    it('should be configured with correct settings', () => {
      expect(authLimiter).toBeDefined();
      expect(authLimiter.options.windowMs).toBe(config.authRateLimiter.windowMs);
      expect(authLimiter.options.max).toBe(config.authRateLimiter.maxRequests);
      expect(authLimiter.options.standardHeaders).toBe(true);
      expect(authLimiter.options.legacyHeaders).toBe(false);
      expect(authLimiter.options.message).toBe('Too many login attempts, please try again later');
    });
  });

  describe('apiLimiter', () => {
    it('should be configured with correct settings', () => {
      expect(apiLimiter).toBeDefined();
      expect(apiLimiter.options.windowMs).toBe(config.rateLimiter.windowMs);
      expect(apiLimiter.options.max).toBe(config.rateLimiter.maxRequests);
      expect(apiLimiter.options.standardHeaders).toBe(true);
      expect(apiLimiter.options.legacyHeaders).toBe(false);
      expect(apiLimiter.options.message).toBe('Too many requests, please try again later');
    });
  });
}); 