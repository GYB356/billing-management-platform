import { prisma } from '@/lib/prisma';
import { Metric } from '@prisma/client';
import * as math from 'mathjs';
import * as stats from 'stats-lite';

interface StatisticalAnalysis {
  descriptive: {
    mean: number;
    median: number;
    mode: number;
    stdDev: number;
    variance: number;
    skewness: number;
    kurtosis: number;
    min: number;
    max: number;
    range: number;
    iqr: number;
  };
  correlation: {
    pearson: number;
    spearman: number;
    kendall: number;
  };
  distribution: {
    isNormal: boolean;
    shapiroWilk: number;
    andersonDarling: number;
  };
  seasonality: {
    hasSeasonality: boolean;
    period: number;
    strength: number;
  };
}

export class StatisticalAnalysisService {
  /**
   * Perform comprehensive statistical analysis on metrics
   */
  async analyzeMetrics(
    metricName: string,
    startTime: Date,
    endTime: Date
  ): Promise<StatisticalAnalysis> {
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
      throw new Error('Insufficient data points for statistical analysis');
    }

    const values = metrics.map((m) => m.value);
    const timestamps = metrics.map((m) => m.timestamp.getTime());

    return {
      descriptive: this.calculateDescriptiveStats(values),
      correlation: this.calculateCorrelations(values, timestamps),
      distribution: this.analyzeDistribution(values),
      seasonality: this.detectSeasonality(values),
    };
  }

  private calculateDescriptiveStats(values: number[]): StatisticalAnalysis['descriptive'] {
    const sorted = [...values].sort((a, b) => a - b);
    const mean = stats.mean(values);
    const variance = stats.variance(values);
    const stdDev = Math.sqrt(variance);

    return {
      mean,
      median: stats.median(sorted),
      mode: this.calculateMode(values),
      stdDev,
      variance,
      skewness: this.calculateSkewness(values, mean, stdDev),
      kurtosis: this.calculateKurtosis(values, mean, stdDev),
      min: sorted[0],
      max: sorted[sorted.length - 1],
      range: sorted[sorted.length - 1] - sorted[0],
      iqr: stats.percentile(sorted, 0.75) - stats.percentile(sorted, 0.25),
    };
  }

  private calculateCorrelations(
    values: number[],
    timestamps: number[]
  ): StatisticalAnalysis['correlation'] {
    return {
      pearson: this.calculatePearsonCorrelation(values, timestamps),
      spearman: this.calculateSpearmanCorrelation(values, timestamps),
      kendall: this.calculateKendallCorrelation(values, timestamps),
    };
  }

  private analyzeDistribution(values: number[]): StatisticalAnalysis['distribution'] {
    const shapiroWilk = this.calculateShapiroWilk(values);
    const andersonDarling = this.calculateAndersonDarling(values);

    return {
      isNormal: shapiroWilk > 0.95 && andersonDarling < 0.05,
      shapiroWilk,
      andersonDarling,
    };
  }

  private detectSeasonality(values: number[]): StatisticalAnalysis['seasonality'] {
    const acf = this.calculateACF(values);
    const maxLag = Math.min(24, Math.floor(values.length / 2));
    let maxCorrelation = 0;
    let period = 0;

    for (let lag = 1; lag <= maxLag; lag++) {
      if (acf[lag] > maxCorrelation) {
        maxCorrelation = acf[lag];
        period = lag;
      }
    }

    return {
      hasSeasonality: maxCorrelation > 0.5,
      period,
      strength: maxCorrelation,
    };
  }

  private calculateMode(values: number[]): number {
    const frequency: Record<number, number> = {};
    values.forEach((value) => {
      frequency[value] = (frequency[value] || 0) + 1;
    });

    let maxCount = 0;
    let mode = values[0];

    Object.entries(frequency).forEach(([value, count]) => {
      if (count > maxCount) {
        maxCount = count;
        mode = Number(value);
      }
    });

    return mode;
  }

  private calculateSkewness(values: number[], mean: number, stdDev: number): number {
    const n = values.length;
    const sum = values.reduce((acc, val) => acc + Math.pow((val - mean) / stdDev, 3), 0);
    return (n / ((n - 1) * (n - 2))) * sum;
  }

  private calculateKurtosis(values: number[], mean: number, stdDev: number): number {
    const n = values.length;
    const sum = values.reduce((acc, val) => acc + Math.pow((val - mean) / stdDev, 4), 0);
    return (n * (n + 1) / ((n - 1) * (n - 2) * (n - 3))) * sum -
      (3 * Math.pow(n - 1, 2) / ((n - 2) * (n - 3)));
  }

  private calculatePearsonCorrelation(x: number[], y: number[]): number {
    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
    const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

    return numerator / denominator;
  }

  private calculateSpearmanCorrelation(x: number[], y: number[]): number {
    const rankX = this.calculateRanks(x);
    const rankY = this.calculateRanks(y);
    return this.calculatePearsonCorrelation(rankX, rankY);
  }

  private calculateKendallCorrelation(x: number[], y: number[]): number {
    let concordant = 0;
    let discordant = 0;

    for (let i = 0; i < x.length; i++) {
      for (let j = i + 1; j < x.length; j++) {
        const xDiff = x[i] - x[j];
        const yDiff = y[i] - y[j];
        if (xDiff * yDiff > 0) concordant++;
        else if (xDiff * yDiff < 0) discordant++;
      }
    }

    return (concordant - discordant) / (concordant + discordant);
  }

  private calculateRanks(values: number[]): number[] {
    const sorted = [...values].sort((a, b) => a - b);
    return values.map((value) => sorted.indexOf(value) + 1);
  }

  private calculateACF(values: number[]): number[] {
    const mean = stats.mean(values);
    const n = values.length;
    const acf: number[] = [];

    for (let lag = 0; lag < n; lag++) {
      let numerator = 0;
      let denominator = 0;

      for (let i = 0; i < n - lag; i++) {
        numerator += (values[i] - mean) * (values[i + lag] - mean);
        denominator += Math.pow(values[i] - mean, 2);
      }

      acf.push(numerator / denominator);
    }

    return acf;
  }

  private calculateShapiroWilk(values: number[]): number {
    // Simplified implementation
    const n = values.length;
    const mean = stats.mean(values);
    const stdDev = Math.sqrt(stats.variance(values));
    const standardized = values.map((x) => (x - mean) / stdDev);
    const sumSquared = standardized.reduce((sum, x) => sum + x * x, 0);
    return 1 - (sumSquared / (n - 1));
  }

  private calculateAndersonDarling(values: number[]): number {
    // Simplified implementation
    const n = values.length;
    const sorted = [...values].sort((a, b) => a - b);
    const mean = stats.mean(values);
    const stdDev = Math.sqrt(stats.variance(values));
    const standardized = sorted.map((x) => (x - mean) / stdDev);
    const cdf = standardized.map((x) => 0.5 * (1 + math.erf(x / Math.sqrt(2))));
    
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const term = (2 * (i + 1) - 1) * (Math.log(cdf[i]) + Math.log(1 - cdf[n - 1 - i]));
      sum += term;
    }
    
    return -n - sum / n;
  }
} 