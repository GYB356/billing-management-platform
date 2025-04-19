interface RateLimitData {
  count: number;
  lastReset: number;
}

const rateLimitStore: Record<string, RateLimitData> = {};

function rateLimit(id: string) {
  const now = Date.now();
  const minute = 60 * 1000;

  if (!rateLimitStore[id]) {
    rateLimitStore[id] = {
      count: 1,
      lastReset: now,
    };
  } else {
    const data = rateLimitStore[id];
    if (now - data.lastReset > minute) {
      data.count = 1;
      data.lastReset = now;
    } else {
      data.count++;
      if (data.count > 100) {
        throw new Error('Rate limit exceeded');
      }
    }
  }
}

export { rateLimit };