import { rateLimit } from '@/lib/utils/rate-limit';

describe('rateLimit', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should allow 100 requests per minute', () => {
    const id = 'test-id';
    for (let i = 0; i < 100; i++) {
      expect(() => rateLimit(id)).not.toThrow();
    }
  });

  it('should throw an error if the limit is exceeded', () => {
    const id = 'test-id-exceeded';
    for (let i = 0; i < 100; i++) {
      rateLimit(id);
    }
    expect(() => rateLimit(id)).toThrow('Rate limit exceeded');
  });

  it('should reset the count after one minute', () => {
    const id = 'test-id-reset';
    for (let i = 0; i < 100; i++) {
      rateLimit(id);
    }
    expect(() => rateLimit(id)).toThrow('Rate limit exceeded');
    jest.advanceTimersByTime(60000);
    expect(() => rateLimit(id)).not.toThrow();
  });
});