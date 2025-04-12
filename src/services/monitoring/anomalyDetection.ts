import { sendAlert } from '../notifications';

interface Metric {
  timestamp: Date;
  value: number;
  type: 'cpu' | 'payment' | 'churn';
}

class AnomalyDetection {
  private thresholds = {
    cpu: 90, // 90% CPU usage
    payment: 0.1, // 10% failed payments
    churn: 0.05 // 5% churn rate
  };

  private metrics: Record<string, Metric[]> = {
    cpu: [],
    payment: [],
    churn: []
  };

  async detectAnomalies(metric: Metric): Promise<void> {
    this.metrics[metric.type].push(metric);
    
    // Keep only last 24 hours of data
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    this.metrics[metric.type] = this.metrics[metric.type].filter(m => m.timestamp > dayAgo);

    const isAnomaly = await this.isAnomaly(metric);
    if (isAnomaly) {
      await this.alertAdmins(metric);
    }
  }

  private async isAnomaly(metric: Metric): Promise<boolean> {
    // Simple threshold-based detection
    if (metric.type === 'cpu' && metric.value > this.thresholds.cpu) {
      return true;
    }

    if (metric.type === 'payment' && this.calculateFailureRate() > this.thresholds.payment) {
      return true;
    }

    if (metric.type === 'churn' && this.calculateChurnRate() > this.thresholds.churn) {
      return true;
    }

    return false;
  }

  private calculateFailureRate(): number {
    const recentPayments = this.metrics.payment.slice(-100);
    const failedPayments = recentPayments.filter(m => m.value === 0).length;
    return failedPayments / recentPayments.length;
  }

  private calculateChurnRate(): number {
    const recentChurn = this.metrics.churn.slice(-100);
    return recentChurn.reduce((acc, curr) => acc + curr.value, 0) / recentChurn.length;
  }

  private async alertAdmins(metric: Metric): Promise<void> {
    const message = `Anomaly detected:
      Type: ${metric.type}
      Value: ${metric.value}
      Time: ${metric.timestamp}
      Please check the dashboard for more details.`;
    
    await sendAlert({
      type: 'anomaly',
      message,
      severity: 'high'
    });
  }
}

export const anomalyDetection = new AnomalyDetection(); 