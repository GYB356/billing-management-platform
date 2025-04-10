import { prisma } from '../prisma';
import { subMonths, startOfMonth, endOfMonth } from 'date-fns';
import * as stats from 'simple-statistics';

export interface RevenueForecast {
  date: Date;
  predicted: number;
  upperBound: number;
  lowerBound: number;
  confidence: number;
}

export interface RevenueMetrics {
  mrr: number;
  arr: number;
  growth: {
    percentage: number;
    trend: 'up' | 'down' | 'neutral';
  };
  netRevenueRetention: number;
  grossRevenueRetention: number;
  expansionRevenue: number;
  contractionRevenue: number;
  revenueChurn: number;
}

export class RevenueForecastService {
  static async getHistoricalRevenue(months: number = 24): Promise<Array<{ date: Date; amount: number }>> {
    const startDate = subMonths(new Date(), months);
    
    const monthlyRevenue = await prisma.invoice.groupBy({
      by: ['createdAt'],
      where: {
        status: 'PAID',
        createdAt: {
          gte: startDate
        }
      },
      _sum: {
        totalAmount: true
      }
    });

    return monthlyRevenue.map(mr => ({
      date: mr.createdAt,
      amount: mr._sum.totalAmount || 0
    }));
  }

  static async generateForecast(forecastMonths: number = 12): Promise<RevenueForecast[]> {
    const historicalData = await this.getHistoricalRevenue();
    const amounts = historicalData.map(d => d.amount);
    
    // Calculate trend using linear regression
    const points = amounts.map((y, i) => [i, y]);
    const regression = stats.linearRegression(points);
    
    // Calculate volatility for confidence intervals
    const volatility = stats.standardDeviation(amounts);
    
    const forecasts: RevenueForecast[] = [];
    const lastDate = historicalData[historicalData.length - 1].date;
    
    for (let i = 1; i <= forecastMonths; i++) {
      const predictedValue = regression.m * (amounts.length + i) + regression.b;
      const confidence = Math.max(0.5, 1 - (i * 0.025)); // Decreasing confidence over time
      const margin = volatility * 1.96 * (1 + i * 0.1); // Increasing margin of error over time
      
      forecasts.push({
        date: new Date(lastDate.setMonth(lastDate.getMonth() + 1)),
        predicted: predictedValue,
        upperBound: predictedValue + margin,
        lowerBound: predictedValue - margin,
        confidence
      });
    }
    
    return forecasts;
  }

  static async getCurrentMetrics(): Promise<RevenueMetrics> {
    const now = new Date();
    const startOfCurrentMonth = startOfMonth(now);
    const startOfLastMonth = startOfMonth(subMonths(now, 1));
    
    const [currentMRR, lastMonthMRR, expansionContractionMetrics] = await Promise.all([
      this.calculateMRR(startOfCurrentMonth),
      this.calculateMRR(startOfLastMonth),
      this.calculateExpansionContractionRevenue(startOfCurrentMonth)
    ]);

    const growth = {
      percentage: lastMonthMRR > 0 ? ((currentMRR - lastMonthMRR) / lastMonthMRR) * 100 : 0,
      trend: currentMRR > lastMonthMRR ? 'up' : currentMRR < lastMonthMRR ? 'down' : 'neutral'
    };

    const { expansionRevenue, contractionRevenue } = expansionContractionMetrics;
    const netRevenueRetention = lastMonthMRR > 0 ? (currentMRR / lastMonthMRR) * 100 : 100;
    const grossRevenueRetention = lastMonthMRR > 0 ? ((currentMRR - expansionRevenue) / lastMonthMRR) * 100 : 100;
    const revenueChurn = 100 - grossRevenueRetention;

    return {
      mrr: currentMRR,
      arr: currentMRR * 12,
      growth,
      netRevenueRetention,
      grossRevenueRetention,
      expansionRevenue,
      contractionRevenue,
      revenueChurn
    };
  }

  private static async calculateMRR(date: Date): Promise<number> {
    const result = await prisma.subscription.aggregate({
      where: {
        status: 'ACTIVE',
        startDate: {
          lte: date
        },
        OR: [
          { endDate: null },
          { endDate: { gt: date } }
        ]
      },
      _sum: {
        price: true
      }
    });

    return result._sum.price || 0;
  }

  private static async calculateExpansionContractionRevenue(date: Date): Promise<{
    expansionRevenue: number;
    contractionRevenue: number;
  }> {
    const startOfMonth = startOfMonth(date);
    const endOfMonth = endOfMonth(date);

    const subscriptionChanges = await prisma.subscription.findMany({
      where: {
        updatedAt: {
          gte: startOfMonth,
          lte: endOfMonth
        }
      },
      select: {
        id: true,
        price: true,
        previousPrice: true
      }
    });

    let expansionRevenue = 0;
    let contractionRevenue = 0;

    subscriptionChanges.forEach(sub => {
      if (!sub.previousPrice) return;
      
      const difference = sub.price - sub.previousPrice;
      if (difference > 0) {
        expansionRevenue += difference;
      } else {
        contractionRevenue += Math.abs(difference);
      }
    });

    return { expansionRevenue, contractionRevenue };
  }
}