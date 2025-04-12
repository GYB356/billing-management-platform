import { anomalyDetection } from '../../../services/monitoring/anomalyDetection';
import { sendAlert } from '../../../services/notifications';

jest.mock('../../../services/notifications');

describe('AnomalyDetection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('detectAnomalies', () => {
    it('should detect CPU usage spike', async () => {
      const metric = {
        timestamp: new Date(),
        type: 'cpu' as const,
        value: 95 // Above 90% threshold
      };

      await anomalyDetection.detectAnomalies(metric);

      expect(sendAlert).toHaveBeenCalledWith({
        type: 'anomaly',
        message: expect.stringContaining('CPU'),
        severity: 'high'
      });
    });

    it('should not alert for normal CPU usage', async () => {
      const metric = {
        timestamp: new Date(),
        type: 'cpu' as const,
        value: 85 // Below 90% threshold
      };

      await anomalyDetection.detectAnomalies(metric);

      expect(sendAlert).not.toHaveBeenCalled();
    });

    it('should detect payment failure spike', async () => {
      // First, simulate multiple failed payments
      const failedPayments = Array(11).fill({
        timestamp: new Date(),
        type: 'payment' as const,
        value: 0
      });

      // Add some successful payments
      const successfulPayments = Array(89).fill({
        timestamp: new Date(),
        type: 'payment' as const,
        value: 1
      });

      // Submit all payments
      for (const payment of [...failedPayments, ...successfulPayments]) {
        await anomalyDetection.detectAnomalies(payment);
      }

      expect(sendAlert).toHaveBeenCalledWith({
        type: 'anomaly',
        message: expect.stringContaining('payment'),
        severity: 'high'
      });
    });

    it('should detect churn rate spike', async () => {
      const metric = {
        timestamp: new Date(),
        type: 'churn' as const,
        value: 0.06 // Above 5% threshold
      };

      await anomalyDetection.detectAnomalies(metric);

      expect(sendAlert).toHaveBeenCalledWith({
        type: 'anomaly',
        message: expect.stringContaining('churn'),
        severity: 'high'
      });
    });

    it('should maintain 24-hour data window', async () => {
      const now = new Date();
      const dayAgo = new Date(now.getTime() - 25 * 60 * 60 * 1000); // 25 hours ago

      // Add old metric
      await anomalyDetection.detectAnomalies({
        timestamp: dayAgo,
        type: 'cpu' as const,
        value: 95
      });

      // Add new metric
      await anomalyDetection.detectAnomalies({
        timestamp: now,
        type: 'cpu' as const,
        value: 85
      });

      // Old metric should be filtered out, so no alert
      expect(sendAlert).not.toHaveBeenCalled();
    });
  });
}); 