import { prisma } from '../prisma';
import { EventEmitter } from 'events';
import { createMetric } from './metrics';

interface WebhookMetrics {
  totalDeliveries: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  pendingDeliveries: number;
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  errorRate: number;
}

class WebhookMonitor extends EventEmitter {
  private static instance: WebhookMonitor;
  private metricsCache: Map<string, WebhookMetrics>;
  private updateInterval: NodeJS.Timer | null;

  private constructor() {
    super();
    this.metricsCache = new Map();
    this.updateInterval = null;
  }

  public static getInstance(): WebhookMonitor {
    if (!WebhookMonitor.instance) {
      WebhookMonitor.instance = new WebhookMonitor();
    }
    return WebhookMonitor.instance;
  }

  /**
   * Start monitoring webhooks
   */
  public async start(intervalMs: number = 60000) {
    await this.updateMetrics();
    this.updateInterval = setInterval(() => this.updateMetrics(), intervalMs);
  }

  /**
   * Stop monitoring webhooks
   */
  public stop() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  /**
   * Get metrics for an organization
   */
  public getMetrics(organizationId: string): WebhookMetrics | null {
    return this.metricsCache.get(organizationId) || null;
  }

  /**
   * Update metrics for all organizations
   */
  private async updateMetrics() {
    try {
      // Get all organizations with webhooks
      const organizations = await prisma.organization.findMany({
        where: {
          webhooks: {
            some: {},
          },
        },
        select: {
          id: true,
        },
      });

      // Update metrics for each organization
      await Promise.all(
        organizations.map(org => this.updateOrganizationMetrics(org.id))
      );
    } catch (error) {
      console.error('Error updating webhook metrics:', error);
      this.emit('error', error);
    }
  }

  /**
   * Update metrics for a specific organization
   */
  private async updateOrganizationMetrics(organizationId: string) {
    try {
      // Get delivery counts by status
      const deliveryCounts = await prisma.webhookDelivery.groupBy({
        by: ['status'],
        where: {
          webhook: {
            organizationId,
          },
        },
        _count: true,
      });

      // Calculate total deliveries
      const totalDeliveries = deliveryCounts.reduce((acc, curr) => acc + curr._count, 0);
      const successfulDeliveries = deliveryCounts.find(d => d.status === 'COMPLETED')?._count || 0;
      const failedDeliveries = deliveryCounts.find(d => d.status === 'FAILED')?._count || 0;
      const pendingDeliveries = deliveryCounts.find(d => d.status === 'PENDING')?._count || 0;

      // Calculate error rate
      const errorRate = totalDeliveries > 0 ? (failedDeliveries / totalDeliveries) * 100 : 0;

      // Get response time percentiles
      const responseTimes = await prisma.$queryRaw`
        SELECT
          AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) as avg_response_time,
          percentile_cont(0.95) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (updated_at - created_at))) as p95_response_time,
          percentile_cont(0.99) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (updated_at - created_at))) as p99_response_time
        FROM webhook_deliveries
        WHERE status = 'COMPLETED'
        AND webhook_id IN (
          SELECT id FROM webhooks WHERE organization_id = ${organizationId}
        )
      `;

      const metrics: WebhookMetrics = {
        totalDeliveries,
        successfulDeliveries,
        failedDeliveries,
        pendingDeliveries,
        averageResponseTime: responseTimes[0]?.avg_response_time || 0,
        p95ResponseTime: responseTimes[0]?.p95_response_time || 0,
        p99ResponseTime: responseTimes[0]?.p99_response_time || 0,
        errorRate,
      };

      // Update cache
      this.metricsCache.set(organizationId, metrics);

      // Emit metrics update event
      this.emit('metricsUpdated', { organizationId, metrics });

      // Record metrics
      await Promise.all([
        createMetric('webhook.deliveries.total', totalDeliveries, { organizationId }),
        createMetric('webhook.deliveries.successful', successfulDeliveries, { organizationId }),
        createMetric('webhook.deliveries.failed', failedDeliveries, { organizationId }),
        createMetric('webhook.deliveries.pending', pendingDeliveries, { organizationId }),
        createMetric('webhook.response_time.average', metrics.averageResponseTime, { organizationId }),
        createMetric('webhook.response_time.p95', metrics.p95ResponseTime, { organizationId }),
        createMetric('webhook.response_time.p99', metrics.p99ResponseTime, { organizationId }),
        createMetric('webhook.error_rate', errorRate, { organizationId }),
      ]);

      // Check for anomalies
      this.detectAnomalies(organizationId, metrics);
    } catch (error) {
      console.error(`Error updating metrics for organization ${organizationId}:`, error);
      this.emit('error', { organizationId, error });
    }
  }

  /**
   * Detect anomalies in webhook metrics
   */
  private async detectAnomalies(organizationId: string, metrics: WebhookMetrics) {
    // High error rate alert
    if (metrics.errorRate > 10) {
      this.emit('anomaly', {
        organizationId,
        type: 'HIGH_ERROR_RATE',
        message: `High webhook error rate detected: ${metrics.errorRate.toFixed(2)}%`,
        metrics,
      });
    }

    // High response time alert
    if (metrics.p95ResponseTime > 5000) {
      this.emit('anomaly', {
        organizationId,
        type: 'HIGH_RESPONSE_TIME',
        message: `High webhook response time detected: P95 ${metrics.p95ResponseTime.toFixed(2)}ms`,
        metrics,
      });
    }

    // High pending deliveries alert
    if (metrics.pendingDeliveries > 100) {
      this.emit('anomaly', {
        organizationId,
        type: 'HIGH_PENDING_DELIVERIES',
        message: `High number of pending deliveries: ${metrics.pendingDeliveries}`,
        metrics,
      });
    }
  }
}

export const webhookMonitor = WebhookMonitor.getInstance(); 