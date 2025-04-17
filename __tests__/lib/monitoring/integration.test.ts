import { NextApiRequest, NextApiResponse } from 'next';
import { Monitoring, withMonitoring } from '@/lib/monitoring';
import { logSecurityEvent } from '@/lib/security/logging';
import { captureException } from '@sentry/nextjs';
import {
  createMockRequest,
  createMockResponse,
  createMonitoringOptions,
  mockPerformanceNow,
  mockConsole,
  advanceTimersByTime,
  simulateNetworkError,
  simulateDatabaseError,
} from './setup';

jest.mock('@/lib/security/logging');
jest.mock('@sentry/nextjs');
jest.mock('perf_hooks');

describe('Monitoring Integration Tests', () => {
  let monitoring: Monitoring;
  let consoleMock: ReturnType<typeof mockConsole>;

  beforeEach(() => {
    jest.clearAllMocks();
    monitoring = Monitoring.getInstance();
    consoleMock = mockConsole();
  });

  afterEach(() => {
    consoleMock.restore();
    jest.useRealTimers();
  });

  describe('API Route Monitoring', () => {
    it('should track complete request lifecycle', async () => {
      const mockReq = createMockRequest();
      const mockRes = createMockResponse();
      const mockData = { id: 1, name: 'Test' };

      const handler = jest.fn().mockImplementation(async (req, res) => {
        await new Promise(resolve => setTimeout(resolve, 100));
        res.status(200).json(mockData);
      });

      const wrappedHandler = withMonitoring(handler);
      
      mockPerformanceNow([0, 150]); // Simulate 150ms duration
      jest.useFakeTimers();

      const handlerPromise = wrappedHandler(
        mockReq as NextApiRequest,
        mockRes as NextApiResponse
      );

      await advanceTimersByTime(100);
      await handlerPromise;

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(mockData);
      expect(logSecurityEvent).toHaveBeenCalled();
    });

    it('should handle concurrent requests', async () => {
      const handlers = Array(3).fill(null).map(() => 
        withMonitoring(jest.fn().mockResolvedValue(undefined))
      );

      const requests = handlers.map(handler =>
        handler(
          createMockRequest() as NextApiRequest,
          createMockResponse() as NextApiResponse
        )
      );

      await Promise.all(requests);

      expect(logSecurityEvent).toHaveBeenCalledTimes(3);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle and recover from transient errors', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(simulateNetworkError())
        .mockResolvedValueOnce({ success: true });

      const result = await monitoring.trackPerformance(
        operation,
        createMonitoringOptions()
      );

      expect(result).toEqual({ success: true });
      expect(operation).toHaveBeenCalledTimes(2);
      expect(captureException).toHaveBeenCalledTimes(1);
    });

    it('should handle cascading failures', async () => {
      const primaryOperation = jest.fn().mockRejectedValue(simulateDatabaseError());
      const fallbackOperation = jest.fn().mockResolvedValue({ success: true });

      try {
        await monitoring.trackPerformance(primaryOperation, createMonitoringOptions());
      } catch {
        await monitoring.trackPerformance(fallbackOperation, createMonitoringOptions());
      }

      expect(fallbackOperation).toHaveBeenCalled();
      expect(captureException).toHaveBeenCalledTimes(1);
    });
  });

  describe('Performance Monitoring', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    it('should track memory leaks', async () => {
      const memoryUsage = [
        { heapUsed: 1000000 },
        { heapUsed: 2000000 },
        { heapUsed: 3000000 },
      ];

      let callCount = 0;
      jest.spyOn(process, 'memoryUsage').mockImplementation(() => 
        memoryUsage[callCount++] as NodeJS.MemoryUsage
      );

      for (let i = 0; i < 3; i++) {
        await monitoring.trackPerformance(
          () => Promise.resolve(),
          createMonitoringOptions()
        );
      }

      await advanceTimersByTime(60000);

      expect(logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            maxMemory: 3000000,
          }),
        })
      );
    });

    it('should detect performance degradation over time', async () => {
      const operations = [100, 200, 500, 1000].map(duration => async () => {
        await new Promise(resolve => setTimeout(resolve, duration));
        return true;
      });

      for (const operation of operations) {
        await monitoring.trackPerformance(
          operation,
          createMonitoringOptions()
        );
      }

      await advanceTimersByTime(60000);

      expect(consoleMock.spies.warn).toHaveBeenCalled();
      expect(logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            averageDuration: expect.any(Number),
          }),
        })
      );
    });
  });

  describe('Resource Cleanup', () => {
    it('should cleanup resources on error', async () => {
      const mockCleanup = jest.fn();
      const operation = async () => {
        try {
          throw simulateDatabaseError();
        } finally {
          mockCleanup();
        }
      };

      await expect(
        monitoring.trackPerformance(operation, createMonitoringOptions())
      ).rejects.toThrow();

      expect(mockCleanup).toHaveBeenCalled();
    });

    it('should handle multiple cleanup steps', async () => {
      const cleanups = [jest.fn(), jest.fn(), jest.fn()];
      const operation = async () => {
        try {
          await Promise.resolve();
        } finally {
          cleanups.forEach(cleanup => cleanup());
        }
      };

      await monitoring.trackPerformance(operation, createMonitoringOptions());

      cleanups.forEach(cleanup => {
        expect(cleanup).toHaveBeenCalled();
      });
    });
  });
});