// Advanced metrics collection for business insights

import { MetricsCollector } from './metricsCollector';
import { AnalyticsProcessor } from './analyticsProcessor';

export class BusinessMetrics {
  private metricsCollector: MetricsCollector;
  private analyticsProcessor: AnalyticsProcessor;

  constructor() {
    this.metricsCollector = new MetricsCollector();
    this.analyticsProcessor = new AnalyticsProcessor();
  }

  collectMetrics(): void {
    const metrics = this.metricsCollector.collect();
    this.analyticsProcessor.process(metrics);
  }

  getInsights(): any {
    return this.analyticsProcessor.getInsights();
  }
}