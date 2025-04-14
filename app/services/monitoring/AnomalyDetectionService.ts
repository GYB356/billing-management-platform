import { prisma } from '@/lib/prisma';
import { Metric } from '@prisma/client';

interface AnomalyResult {
  isAnomaly: boolean;
  score: number;
  threshold: number;
  timestamp: Date;
  value: number;
  metadata: Record<string, any>;
}

interface TrendAnalysis {
  slope: number;
  intercept: number;
  rSquared: number;
  forecast: number[];
  confidenceInterval: [number, number];
}

export class AnomalyDetectionService {
  private readonly WINDOW_SIZE = 30; // Number of points for moving average
  private readonly Z_SCORE_THRESHOLD = 3; // Standard deviations for anomaly detection

  /**
   * Detect anomalies using Z-score method
   */
  async detectAnomalies(
    metricName: string,
    startTime: Date,
    endTime: Date
  ): Promise<AnomalyResult[]> {
    const metrics = await prisma.metric.findMany({
      where: {
        name: metricName,
        timestamp: {
          gte: startTime,
          lte: endTime,
        },
      },
      orderBy: {
        timestamp: 'asc',
      },
    });

    if (metrics.length < this.WINDOW_SIZE) {
      throw new Error('Insufficient data points for anomaly detection');
    }

    const results: AnomalyResult[] = [];
    const values = metrics.map((m) => m.value);

    for (let i = this.WINDOW_SIZE; i < values.length; i++) {
      const window = values.slice(i - this.WINDOW_SIZE, i);
      const mean = this.calculateMean(window);
      const stdDev = this.calculateStandardDeviation(window, mean);
      const zScore = Math.abs((values[i] - mean) / stdDev);

      results.push({
        isAnomaly: zScore > this.Z_SCORE_THRESHOLD,
        score: zScore,
        threshold: this.Z_SCORE_THRESHOLD,
        timestamp: metrics[i].timestamp,
        value: values[i],
        metadata: {
          mean,
          stdDev,
          windowSize: this.WINDOW_SIZE,
        },
      });
    }

    return results;
  }

  /**
   * Analyze trends using linear regression
   */
  async analyzeTrend(
    metricName: string,
    startTime: Date,
    endTime: Date
  ): Promise<TrendAnalysis> {
    const metrics = await prisma.metric.findMany({
      where: {
        name: metricName,
        timestamp: {
          gte: startTime,
          lte: endTime,
        },
      },
      orderBy: {
        timestamp: 'asc',
      },
    });

    if (metrics.length < 2) {
      throw new Error('Insufficient data points for trend analysis');
    }

    const x = metrics.map((_, i) => i);
    const y = metrics.map((m) => m.value);

    const { slope, intercept, rSquared } = this.performLinearRegression(x, y);
    const forecast = this.generateForecast(slope, intercept, 5); // Forecast next 5 points
    const confidenceInterval = this.calculateConfidenceInterval(y, slope, intercept);

    return {
      slope,
      intercept,
      rSquared,
      forecast,
      confidenceInterval,
    };
  }

  /**
   * Calculate moving average
   */
  private calculateMovingAverage(values: number[]): number[] {
    const result: number[] = [];
    for (let i = 0; i < values.length; i++) {
      const start = Math.max(0, i - this.WINDOW_SIZE + 1);
      const window = values.slice(start, i + 1);
      result.push(this.calculateMean(window));
    }
    return result;
  }

  /**
   * Calculate mean
   */
  private calculateMean(values: number[]): number {
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  /**
   * Calculate standard deviation
   */
  private calculateStandardDeviation(values: number[], mean: number): number {
    const squaredDifferences = values.map((x) => Math.pow(x - mean, 2));
    return Math.sqrt(squaredDifferences.reduce((a, b) => a + b, 0) / values.length);
  }

  /**
   * Perform linear regression
   */
  private performLinearRegression(
    x: number[],
    y: number[]
  ): { slope: number; intercept: number; rSquared: number } {
    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate R-squared
    const yMean = sumY / n;
    const ssTot = y.reduce((sum, yi) => sum + Math.pow(yi - yMean, 2), 0);
    const ssRes = y.reduce((sum, yi, i) => sum + Math.pow(yi - (slope * x[i] + intercept), 2), 0);
    const rSquared = 1 - ssRes / ssTot;

    return { slope, intercept, rSquared };
  }

  /**
   * Generate forecast
   */
  private generateForecast(slope: number, intercept: number, steps: number): number[] {
    const forecast: number[] = [];
    for (let i = 0; i < steps; i++) {
      forecast.push(slope * i + intercept);
    }
    return forecast;
  }

  /**
   * Calculate confidence interval
   */
  private calculateConfidenceInterval(
    y: number[],
    slope: number,
    intercept: number
  ): [number, number] {
    const n = y.length;
    const yMean = y.reduce((a, b) => a + b, 0) / n;
    const ssRes = y.reduce((sum, yi, i) => sum + Math.pow(yi - (slope * i + intercept), 2), 0);
    const se = Math.sqrt(ssRes / (n - 2));
    const margin = 1.96 * se; // 95% confidence interval

    return [yMean - margin, yMean + margin];
  }
} 