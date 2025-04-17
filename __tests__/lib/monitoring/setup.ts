import { NextApiRequest, NextApiResponse } from 'next';
import { SecurityEventType, SecurityEventSeverity } from '@/lib/security/logging';

// Mock request factory
export const createMockRequest = (overrides: Partial<NextApiRequest> = {}): Partial<NextApiRequest> => ({
  method: 'GET',
  url: '/api/test',
  headers: {
    'x-forwarded-for': '127.0.0.1',
    'user-agent': 'test-agent',
  },
  query: {},
  body: {},
  socket: {
    remoteAddress: '127.0.0.1',
  },
  ...overrides,
});

// Mock response factory
export const createMockResponse = (): Partial<NextApiResponse> => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn(),
  send: jest.fn(),
  end: jest.fn(),
});

// Mock monitoring options factory
export const createMonitoringOptions = (overrides = {}) => ({
  name: 'test-operation',
  userId: 'user123',
  metadata: { test: true },
  ...overrides,
});

// Performance simulation utilities
export const mockPerformanceNow = (values: number[]) => {
  let callCount = 0;
  return jest.spyOn(performance, 'now').mockImplementation(() => {
    return values[callCount++] || values[values.length - 1];
  });
};

export const simulateOperation = async (duration: number) => {
  const start = Date.now();
  while (Date.now() - start < duration) {
    // Simulate CPU work
    Math.random();
  }
};

export const simulateMemoryUsage = (usageInMB: number) => {
  const bytesInMB = 1024 * 1024;
  return jest.spyOn(process, 'memoryUsage').mockReturnValue({
    heapUsed: usageInMB * bytesInMB,
    heapTotal: (usageInMB + 100) * bytesInMB,
    external: 0,
    arrayBuffers: 0,
    rss: (usageInMB + 200) * bytesInMB,
  });
};

// Console mocking utilities
export const mockConsole = () => {
  const spies = {
    log: jest.spyOn(console, 'log').mockImplementation(),
    warn: jest.spyOn(console, 'warn').mockImplementation(),
    error: jest.spyOn(console, 'error').mockImplementation(),
    debug: jest.spyOn(console, 'debug').mockImplementation(),
    info: jest.spyOn(console, 'info').mockImplementation(),
  };
  return {
    spies,
    restore: () => {
      Object.values(spies).forEach(spy => spy.mockRestore());
    },
    getMessages: (type: keyof typeof spies) => 
      spies[type].mock.calls.map(call => call.join(' ')),
  };
};

// Security event assertions
export const expectSecurityEvent = (
  mockFn: jest.Mock,
  type: SecurityEventType,
  severity: SecurityEventSeverity,
  additionalMetadata: Record<string, unknown> = {}
) => {
  expect(mockFn).toHaveBeenCalledWith(
    expect.objectContaining({
      type,
      severity,
      metadata: expect.objectContaining({
        ...additionalMetadata,
      }),
    }),
  );
};

// Timer utilities
export const advanceTimersByTime = async (ms: number) => {
  jest.advanceTimersByTime(ms);
  // Allow any pending promises to resolve
  await Promise.resolve();
};

// Error simulation utilities
export const simulateNetworkError = (message = 'Network error') => 
  new Error(message);

export const simulateDatabaseError = (message = 'Database error') => 
  new Error(message);

export const simulateTimeoutError = (message = 'Operation timed out') => 
  new Error(message);

// Request simulation utilities
export const simulateSlowRequest = async (duration: number) => {
  await new Promise(resolve => setTimeout(resolve, duration));
  return { success: true };
};

export const simulateConcurrentRequests = async (
  count: number,
  handler: (...args: any[]) => Promise<any>
) => {
  const requests = Array(count)
    .fill(null)
    .map(() => handler());
  return Promise.all(requests);
};

// Resource usage simulation
export const simulateResourceUsage = {
  cpu: async (percentage: number, duration: number) => {
    const start = Date.now();
    while (Date.now() - start < duration) {
      if (Math.random() < percentage / 100) {
        // Simulate CPU work
        Math.random();
      } else {
        // Give CPU a break
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
  },
  memory: (sizeInMB: number) => {
    const arr = new Array(sizeInMB * 1024 * 1024 / 8).fill(0);
    return arr; // Return to prevent garbage collection
  },
  io: async (opsPerSecond: number, duration: number) => {
    const start = Date.now();
    let operations = 0;
    while (Date.now() - start < duration) {
      if (operations < (Date.now() - start) * (opsPerSecond / 1000)) {
        await new Promise(resolve => setTimeout(resolve, 1));
        operations++;
      }
    }
    return operations;
  },
}; 