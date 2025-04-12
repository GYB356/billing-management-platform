import { MonitoringService } from '@/lib/services/monitoring-service';
import { EventSeverity } from '@/lib/events';
import type { SystemMetrics, PerformanceMetrics } from '@/types/monitoring';

// Mock implementations
class MockDbOperations {
  private metrics: SystemMetrics[] = [];

  async createMetrics(data: SystemMetrics): Promise<void> {
    this.metrics.push(data);
  }

  async getMetrics(startDate: Date, endDate: Date): Promise<PerformanceMetrics[]> {
    return [{
      timestamp: new Date(),
      cpu: { usage: 0.5, cores: 4, load: [0.5] },
      memory: { total: 8000, used: 4000, free: 4000 },
      requests: { total: 100, success: 95, failed: 5, averageLatency: 200 },
      database: { queries: 50, slowQueries: 2, averageLatency: 100, errors: 1 },
      cache: { hits: 80, misses: 20, hitRate: 0.8, size: 1024 },
      externalServices: {},
    }];
  }
}

class MockEventOperations {
  private events: any[] = [];

  async createEvent(event: any): Promise<void> {
    this.events.push(event);
  }

  getEvents(): any[] {
    return this.events;
  }
}

describe('MonitoringService', () => {
  let monitoringService: MonitoringService;
  let mockDb: MockDbOperations;
  let mockEvents: MockEventOperations;

  beforeEach(() => {
    mockDb = new MockDbOperations();
    mockEvents = new MockEventOperations();
    monitoringService = new MonitoringService(mockDb, mockEvents);
  });

  describe('startMonitoring', () => {
    it('should start monitoring and create event', async () => {
      await monitoringService.startMonitoring();
      
      const events = mockEvents.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        eventType: 'MONITORING_STARTED',
        resourceType: 'SYSTEM',
        severity: EventSeverity.INFO,
      });
    });

    it('should handle errors gracefully', async () => {
      const errorDb = {
        createMetrics: jest.fn().mockRejectedValue(new Error('DB Error')),
        getMetrics: jest.fn(),
      };
      const errorService = new MonitoringService(errorDb, mockEvents);

      await errorService.startMonitoring();
      
      const events = mockEvents.getEvents();
      expect(events[0]).toEqual({
        eventType: 'MONITORING_START_ERROR',
        resourceType: 'SYSTEM',
        severity: EventSeverity.ERROR,
        metadata: {
          error: 'DB Error',
        },
      });
    });
  });

  describe('stopMonitoring', () => {
    it('should stop monitoring and create event', async () => {
      await monitoringService.startMonitoring();
      await monitoringService.stopMonitoring();
      
      const events = mockEvents.getEvents();
      expect(events[1]).toEqual({
        eventType: 'MONITORING_STOPPED',
        resourceType: 'SYSTEM',
        severity: EventSeverity.INFO,
      });
    });
  });

  describe('getPerformanceMetrics', () => {
    it('should return metrics for time range', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-02');
      
      const metrics = await monitoringService.getPerformanceMetrics({
        startDate,
        endDate,
      });

      expect(metrics).toBeDefined();
      expect(metrics.cpu).toBeDefined();
      expect(metrics.memory).toBeDefined();
      expect(metrics.requests).toBeDefined();
    });

    it('should return default metrics when no data available', async () => {
      const emptyDb = {
        createMetrics: jest.fn(),
        getMetrics: jest.fn().mockResolvedValue([]),
      };
      const emptyService = new MonitoringService(emptyDb, mockEvents);

      const metrics = await emptyService.getPerformanceMetrics({});

      expect(metrics).toEqual({
        timestamp: expect.any(Date),
        cpu: { usage: 0, cores: 0, load: [] },
        memory: { total: 0, used: 0, free: 0 },
        requests: { total: 0, success: 0, failed: 0, averageLatency: 0 },
        database: { queries: 0, slowQueries: 0, averageLatency: 0, errors: 0 },
        cache: { hits: 0, misses: 0, hitRate: 0, size: 0 },
        externalServices: {},
      });
    });
  });

  describe('metrics alerts', () => {
    it('should create alert for high CPU usage', async () => {
      const highCpuMetrics: SystemMetrics = {
        timestamp: new Date(),
        cpu: { usage: 0.9, cores: 4, load: [0.9] },
        memory: { total: 8000, used: 4000, free: 4000, swap: { total: 4000, used: 0, free: 4000 } },
        disk: { total: 100000, used: 50000, free: 50000, usage: 0.5 },
        network: { bytesIn: 1000, bytesOut: 1000, connections: 100 },
      };

      await mockDb.createMetrics(highCpuMetrics);
      
      const events = mockEvents.getEvents();
      const cpuAlert = events.find(e => e.eventType === 'HIGH_CPU_USAGE');
      
      expect(cpuAlert).toBeDefined();
      expect(cpuAlert.severity).toBe(EventSeverity.WARNING);
      expect(cpuAlert.metadata.message).toContain('90');
    });

    it('should create alert for high memory usage', async () => {
      const highMemoryMetrics: SystemMetrics = {
        timestamp: new Date(),
        cpu: { usage: 0.5, cores: 4, load: [0.5] },
        memory: { total: 8000, used: 7600, free: 400, swap: { total: 4000, used: 0, free: 4000 } },
        disk: { total: 100000, used: 50000, free: 50000, usage: 0.5 },
        network: { bytesIn: 1000, bytesOut: 1000, connections: 100 },
      };

      await mockDb.createMetrics(highMemoryMetrics);
      
      const events = mockEvents.getEvents();
      const memoryAlert = events.find(e => e.eventType === 'HIGH_MEMORY_USAGE');
      
      expect(memoryAlert).toBeDefined();
      expect(memoryAlert.severity).toBe(EventSeverity.WARNING);
      expect(memoryAlert.metadata.message).toContain('95');
    });
  });
}); 