import { Monitoring } from '@/lib/monitoring';
import { logSecurityEvent, SecurityEventType, SecurityEventSeverity } from '@/lib/security/logging';
import { createMonitoringOptions, mockPerformanceNow, mockConsole } from './setup';

jest.mock('@/lib/security/logging');
jest.mock('perf_hooks');

describe('Performance Monitoring', () => {
  let monitoring: Monitoring;
  let consoleMock: ReturnType<typeof mockConsole>;

  beforeEach(() => {
    jest.clearAllMocks();
    monitoring = Monitoring.getInstance();
    consoleMock = mockConsole();
    jest.useFakeTimers();
  });

  afterEach(() => {
    consoleMock.restore();
    jest.useRealTimers();
  });

  describe('Memory Tracking', () => {
    it('should detect memory leaks', async () => {
      const memoryUsages = [
        { heapUsed: 100_000_000 },  // 100MB
        { heapUsed: 200_000_000 },  // 200MB
        { heapUsed: 500_000_000 },  // 500MB
      ];

      let callCount = 0;
      jest.spyOn(process, 'memoryUsage').mockImplementation(() => 
        memoryUsages[callCount++] as NodeJS.MemoryUsage
      );

      for (let i = 0; i < 3; i++) {
        await monitoring.trackPerformance(
          () => Promise.resolve(),
          createMonitoringOptions({ name: `memory-test-${i}` })
        );
      }

      jest.advanceTimersByTime(60000);

      expect(logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: SecurityEventType.PERFORMANCE_METRICS,
          severity: SecurityEventSeverity.HIGH,
          metadata: expect.objectContaining({
            maxMemory: 500_000_000,
          }),
        })
      );
    });
  });

  describe('Performance Degradation', () => {
    it('should track increasing operation durations', async () => {
      const durations = [100, 200, 500, 1000];
      let durationIndex = 0;

      mockPerformanceNow(
        durations.flatMap(duration => [0, duration])
      );

      for (const _ of durations) {
        await monitoring.trackPerformance(
          () => Promise.resolve(),
          createMonitoringOptions()
        );
      }

      jest.advanceTimersByTime(60000);

      expect(logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            averageDuration: 450, // (100 + 200 + 500 + 1000) / 4
          }),
        })
      );
    });

    it('should identify slow operations', async () => {
      mockPerformanceNow([0, 2000]); // 2 second operation

      await monitoring.trackPerformance(
        () => Promise.resolve(),
        createMonitoringOptions({ name: 'slow-operation' })
      );

      expect(consoleMock.spies.warn).toHaveBeenCalledWith(
        'Slow operation detected:',
        expect.objectContaining({
          name: 'slow-operation',
          duration: 2000,
        })
      );
    });
  });

  describe('Resource Usage', () => {
    it('should track CPU intensive operations', async () => {
      const operation = () => {
        let result = 0;
        for (let i = 0; i < 1000000; i++) {
          result += Math.random();
        }
        return Promise.resolve(result);
      };

      mockPerformanceNow([0, 500]); // 500ms operation

      await monitoring.trackPerformance(
        operation,
        createMonitoringOptions({ name: 'cpu-intensive' })
      );

      expect(logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            duration: 500,
          }),
        })
      );
    });

    it('should handle concurrent operations', async () => {
      const operations = Array(5).fill(null).map((_, i) => ({
        fn: () => Promise.resolve(),
        options: createMonitoringOptions({ name: `concurrent-${i}` })
      }));

      mockPerformanceNow([0, 100, 0, 150, 0, 200, 0, 250, 0, 300]);

      await Promise.all(
        operations.map(({ fn, options }) =>
          monitoring.trackPerformance(fn, options)
        )
      );

      jest.advanceTimersByTime(60000);

      expect(logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            sampleSize: 5,
            averageDuration: 200, // (100 + 150 + 200 + 250 + 300) / 5
          }),
        })
      );
    });
  });
});