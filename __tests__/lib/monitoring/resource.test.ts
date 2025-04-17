import { Monitoring } from '@/lib/monitoring';
import { logSecurityEvent, SecurityEventType, SecurityEventSeverity } from '@/lib/security/logging';
import {
  createMonitoringOptions,
  simulateResourceUsage,
  simulateMemoryUsage,
  expectSecurityEvent,
  mockConsole,
} from './setup';

jest.mock('@/lib/security/logging');
jest.mock('perf_hooks');

describe('Resource Monitoring', () => {
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

  describe('CPU Usage', () => {
    it('should detect high CPU usage', async () => {
      const operation = async () => {
        await simulateResourceUsage.cpu(90, 1000); // 90% CPU for 1 second
        return true;
      };

      await monitoring.trackPerformance(operation, createMonitoringOptions({
        name: 'high-cpu-operation',
      }));

      expect(consoleMock.spies.warn).toHaveBeenCalledWith(
        expect.stringContaining('High CPU usage detected'),
        expect.objectContaining({
          name: 'high-cpu-operation',
          cpuUsage: expect.any(Number),
        })
      );
    });

    it('should track CPU usage over time', async () => {
      const operations = [30, 50, 70, 90].map(cpuPercentage => async () => {
        await simulateResourceUsage.cpu(cpuPercentage, 500);
        return true;
      });

      for (const operation of operations) {
        await monitoring.trackPerformance(operation, createMonitoringOptions());
      }

      jest.advanceTimersByTime(60000);

      expectSecurityEvent(
        logSecurityEvent as jest.Mock,
        SecurityEventType.RESOURCE_METRICS,
        SecurityEventSeverity.HIGH,
        {
          averageCpuUsage: expect.any(Number),
          peakCpuUsage: expect.any(Number),
        }
      );
    });
  });

  describe('Memory Usage', () => {
    it('should detect memory leaks', async () => {
      const memoryUsages = [100, 200, 400, 800]; // MB
      let currentIndex = 0;

      const operation = async () => {
        simulateMemoryUsage(memoryUsages[currentIndex++]);
        return simulateResourceUsage.memory(1); // Allocate 1MB to prevent optimization
      };

      for (let i = 0; i < memoryUsages.length; i++) {
        await monitoring.trackPerformance(operation, createMonitoringOptions({
          name: `memory-test-${i}`,
        }));
      }

      jest.advanceTimersByTime(60000);

      expectSecurityEvent(
        logSecurityEvent as jest.Mock,
        SecurityEventType.RESOURCE_METRICS,
        SecurityEventSeverity.HIGH,
        {
          memoryGrowthRate: expect.any(Number),
          peakMemoryUsage: expect.any(Number),
        }
      );
    });

    it('should handle out of memory scenarios', async () => {
      simulateMemoryUsage(1024); // 1GB usage

      const operation = async () => {
        const arr = simulateResourceUsage.memory(2048); // Try to allocate 2GB
        return arr.length;
      };

      await expect(
        monitoring.trackPerformance(operation, createMonitoringOptions())
      ).rejects.toThrow();

      expect(consoleMock.spies.error).toHaveBeenCalledWith(
        expect.stringContaining('Memory limit exceeded')
      );
    });
  });

  describe('I/O Operations', () => {
    it('should track I/O throughput', async () => {
      const operation = async () => {
        return simulateResourceUsage.io(1000, 500); // 1000 ops/sec for 500ms
      };

      await monitoring.trackPerformance(operation, createMonitoringOptions({
        name: 'io-intensive-operation',
      }));

      jest.advanceTimersByTime(60000);

      expectSecurityEvent(
        logSecurityEvent as jest.Mock,
        SecurityEventType.RESOURCE_METRICS,
        SecurityEventSeverity.LOW,
        {
          ioOperations: expect.any(Number),
          averageLatency: expect.any(Number),
        }
      );
    });

    it('should detect I/O bottlenecks', async () => {
      const operation = async () => {
        // Simulate increasing I/O latency
        const results = await Promise.all([
          simulateResourceUsage.io(100, 100),
          simulateResourceUsage.io(50, 200),
          simulateResourceUsage.io(25, 400),
        ]);
        return results.reduce((a, b) => a + b, 0);
      };

      await monitoring.trackPerformance(operation, createMonitoringOptions({
        name: 'io-bottleneck-test',
      }));

      expect(consoleMock.spies.warn).toHaveBeenCalledWith(
        expect.stringContaining('I/O bottleneck detected'),
        expect.objectContaining({
          name: 'io-bottleneck-test',
          latency: expect.any(Number),
        })
      );
    });
  });

  describe('Resource Limits', () => {
    it('should enforce resource quotas', async () => {
      const operation = async () => {
        await Promise.all([
          simulateResourceUsage.cpu(100, 1000),
          simulateResourceUsage.memory(1024),
          simulateResourceUsage.io(5000, 1000),
        ]);
      };

      await expect(
        monitoring.trackPerformance(operation, createMonitoringOptions({
          resourceLimits: {
            maxCpuPercentage: 80,
            maxMemoryMB: 512,
            maxIoOps: 1000,
          },
        }))
      ).rejects.toThrow('Resource limits exceeded');

      expectSecurityEvent(
        logSecurityEvent as jest.Mock,
        SecurityEventType.RESOURCE_VIOLATION,
        SecurityEventSeverity.HIGH,
        {
          violations: expect.arrayContaining([
            'CPU_LIMIT_EXCEEDED',
            'MEMORY_LIMIT_EXCEEDED',
            'IO_LIMIT_EXCEEDED',
          ]),
        }
      );
    });

    it('should handle graceful degradation', async () => {
      const operation = async () => {
        for (let i = 0; i < 5; i++) {
          await simulateResourceUsage.cpu(20 * (i + 1), 200);
        }
        return true;
      };

      await monitoring.trackPerformance(operation, createMonitoringOptions({
        enableGracefulDegradation: true,
      }));

      expect(consoleMock.spies.info).toHaveBeenCalledWith(
        expect.stringContaining('Graceful degradation activated'),
        expect.objectContaining({
          reducedCpuUsage: expect.any(Number),
          throttledOperations: expect.any(Number),
        })
      );
    });
  });
}); 