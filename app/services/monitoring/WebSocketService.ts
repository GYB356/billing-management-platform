import { Server } from 'socket.io';
import { MonitoringService } from './MonitoringService';
import { AnomalyDetectionService } from './AnomalyDetectionService';

export class WebSocketService {
  private io: Server;
  private monitoringService: MonitoringService;
  private anomalyDetectionService: AnomalyDetectionService;
  private updateIntervals: Map<string, NodeJS.Timeout>;

  constructor(io: Server) {
    this.io = io;
    this.monitoringService = new MonitoringService();
    this.anomalyDetectionService = new AnomalyDetectionService();
    this.updateIntervals = new Map();

    this.setupSocketHandlers();
  }

  private setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      console.log('Client connected:', socket.id);

      socket.on('subscribe', async (data: { metricName: string; interval?: number }) => {
        const { metricName, interval = 5000 } = data;
        const room = `metric:${metricName}`;
        socket.join(room);

        // Start sending updates if not already started
        if (!this.updateIntervals.has(room)) {
          this.startMetricUpdates(room, metricName, interval);
        }
      });

      socket.on('unsubscribe', (data: { metricName: string }) => {
        const { metricName } = data;
        const room = `metric:${metricName}`;
        socket.leave(room);

        // Stop updates if no more subscribers
        if (this.io.sockets.adapter.rooms.get(room)?.size === 0) {
          this.stopMetricUpdates(room);
        }
      });

      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
      });
    });
  }

  private async startMetricUpdates(room: string, metricName: string, interval: number) {
    const updateInterval = setInterval(async () => {
      try {
        const endTime = new Date();
        const startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000); // Last 24 hours

        const metrics = await this.monitoringService.getMetrics(metricName, startTime, endTime);
        const anomalies = await this.anomalyDetectionService.detectAnomalies(metricName, startTime, endTime);
        const trend = await this.anomalyDetectionService.analyzeTrend(metricName, startTime, endTime);

        this.io.to(room).emit('update', {
          metrics,
          anomalies,
          trend,
          timestamp: new Date(),
        });
      } catch (error) {
        console.error('Error in metric updates:', error);
        this.io.to(room).emit('error', { message: 'Failed to fetch metric data' });
      }
    }, interval);

    this.updateIntervals.set(room, updateInterval);
  }

  private stopMetricUpdates(room: string) {
    const interval = this.updateIntervals.get(room);
    if (interval) {
      clearInterval(interval);
      this.updateIntervals.delete(room);
    }
  }
} 