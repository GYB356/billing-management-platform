import { NextApiRequest, NextApiResponse } from 'next';
import { Monitoring, withMonitoring } from '../../../lib/monitoring';
import { logSecurityEvent, SecurityEventType, SecurityEventSeverity } from '../../../lib/security/logging';
import { captureException } from '@sentry/nextjs';
import {
  createMockRequest,
  createMockResponse,
  createMonitoringOptions,
  mockPerformanceNow,
  mockConsole,
  expectSecurityEvent,
} from './setup';

jest.mock('../../../lib/security/logging');
jest.mock('@sentry/nextjs');
jest.mock('perf_hooks');

describe('Monitoring', () => {
  let monitoring: Monitoring;
  let consoleMock: ReturnType<typeof mockConsole>;
  
  beforeEach(() => {
    jest.clearAllMocks();
    monitoring = Monitoring.getInstance();
    consoleMock = mockConsole();
  });

  afterEach(() => {
    consoleMock.restore();
  });

  describe('getInstance', () => {
    it('should return the same instance', () => {
      const instance1 = Monitoring.getInstance();
      const instance2 = Monitoring.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should maintain state between gets', () => {
      const instance1 = Monitoring.getInstance();
      instance1['metricsBuffer'] = [{ duration: 100, memory: process.memoryUsage(), timestamp: Date.now() }];
      
      const instance2 = Monitoring.getInstance();
      expect(instance2['metricsBuffer']).toEqual(instance1['metricsBuffer']);
    });
  });

  describe('trackPerformance', () => {
    const options = createMonitoringOptions();

    it('should track successful operations', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      const result = await monitoring.trackPerformance(operation, options);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalled();
    });

    it('should handle and rethrow errors', async () => {
      const error = new Error('Test error');
      const operation = jest.fn().mockRejectedValue(error);

      await expect(monitoring.trackPerformance(operation, options))
        .rejects.toThrow('Test error');
      
      expect(captureException).toHaveBeenCalledWith(error, {
        extra: expect.objectContaining({
          name: options.name,
          userId: options.userId,
          metadata: options.metadata,
        }),
      });
    });

    it('should track operation duration', async () => {
      mockPerformanceNow([0, 1500]); // Simulate 1.5s duration
      
      const operation = jest.fn().mockResolvedValue('success');
      await monitoring.trackPerformance(operation, options);

      expect(consoleMock.spies.warn).toHaveBeenCalledWith(
        'Slow operation detected:',
        expect.objectContaining({
          name: options.name,
          duration: 1500,
        })
      );
    });

    it('should handle nested operations', async () => {
      const innerOperation = jest.fn().mockResolvedValue('inner');
      const outerOperation = jest.fn().mockImplementation(async () => {
        await monitoring.trackPerformance(innerOperation, {
          ...options,
          name: 'inner-operation',
        });
        return 'outer';
      });

      const result = await monitoring.trackPerformance(outerOperation, {
        ...options,
        name: 'outer-operation',
      });

      expect(result).toBe('outer');
      expect(innerOperation).toHaveBeenCalled();
    });
  });

  describe('withMonitoring middleware', () => {
    let mockReq: Partial<NextApiRequest>;
    let mockRes: Partial<NextApiResponse>;
    let mockHandler: jest.Mock;

    beforeEach(() => {
      mockReq = createMockRequest();
      mockRes = createMockResponse();
      mockHandler = jest.fn().mockResolvedValue(undefined);
    });

    it('should wrap handler with monitoring', async () => {
      const wrappedHandler = withMonitoring(mockHandler);
      await wrappedHandler(mockReq as NextApiRequest, mockRes as NextApiResponse);

      expect(mockHandler).toHaveBeenCalledWith(mockReq, mockRes);
    });

    it('should handle errors in wrapped handler', async () => {
      const error = new Error('Handler error');
      mockHandler.mockRejectedValue(error);

      const wrappedHandler = withMonitoring(mockHandler);
      await expect(wrappedHandler(mockReq as NextApiRequest, mockRes as NextApiResponse))
        .rejects.toThrow('Handler error');

      expect(captureException).toHaveBeenCalledWith(error, expect.any(Object));
    });

    it('should track request metadata', async () => {
      const customReq = createMockRequest({
        method: 'POST',
        url: '/api/custom',
        headers: {
          'x-custom-header': 'test',
        },
        body: { test: true },
      });

      const wrappedHandler = withMonitoring(mockHandler);
      await wrappedHandler(customReq as NextApiRequest, mockRes as NextApiResponse);

      expect(logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            method: 'POST',
            url: '/api/custom',
            headers: expect.objectContaining({
              'x-custom-header': 'test',
            }),
          }),
        })
      );
    });
  });

  describe('metrics collection', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should flush metrics periodically', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      await monitoring.trackPerformance(operation, { name: 'test' });

      jest.advanceTimersByTime(60000);

      expectSecurityEvent(
        logSecurityEvent as jest.Mock,
        SecurityEventType.PERFORMANCE_METRICS,
        SecurityEventSeverity.LOW
      );
    });

    it('should calculate accurate metrics', async () => {
      mockPerformanceNow([0, 100, 0, 200, 0, 300]);

      for (let i = 0; i < 3; i++) {
        await monitoring.trackPerformance(
          jest.fn().mockResolvedValue('success'),
          { name: `operation-${i}` }
        );
      }

      jest.advanceTimersByTime(60000);

      expect(logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            averageDuration: 200, // (100 + 200 + 300) / 3
            sampleSize: 3,
          }),
        })
      );
    });

    it('should handle high memory usage', async () => {
      const highMemoryUsage = { heapUsed: 1024 * 1024 * 1024 }; // 1GB
      jest.spyOn(process, 'memoryUsage').mockReturnValue(highMemoryUsage as NodeJS.MemoryUsage);

      await monitoring.trackPerformance(
        jest.fn().mockResolvedValue('success'),
        { name: 'high-memory-operation' }
      );

      jest.advanceTimersByTime(60000);

      expectSecurityEvent(
        logSecurityEvent as jest.Mock,
        SecurityEventType.PERFORMANCE_METRICS,
        SecurityEventSeverity.HIGH
      );
    });
  });
});