import { prisma } from '../../../lib/prisma';
import { PricingPlan, PriceHistory, Subscription, PriceTest, PriceTestVariant } from '@prisma/client';

interface MarketBenchmark {
  minPrice: number;
  maxPrice: number;
  avgPrice: number;
  medianPrice: number;
  segment: string;
  productType: string;
  collectedAt: Date;
}

interface MarketCondition {
  competitorPrices: number[];
  marketDemand: number; // 0-1 scale
  seasonality: number; // 0-1 scale
}

interface PriceOptimizationResult {
  recommendedPrice: number;
  confidence: number;
  factors: {
    historicalPerformance: number;
    marketConditions: number;
    customerSegment: number;
    elasticity: number;
  };
}

interface ChurnRisk {
  probability: number;
  factors: Record<string, number>;
}

interface PriceElasticityResult {
  elasticity: number;
  date: Date;
}

interface MarketPositionResult {
  currentPrice: number;
  marketAverage: number;
  marketMedian: number;
  percentile: number;
  recommendation: string;
}

interface PriceOptimizationFactors {
  elasticity: number;
  marketPressure: number;
  churnRisk: number;
}

interface RevenueProjection {
  month: number;
  subscribers: number;
  revenue: number;
  churnRate: number;
}

export class DynamicPricingEngine {
  private readonly MIN_DATA_POINTS = 100;
  private readonly PRICE_CHANGE_THRESHOLD = 0.05; // 5%
  private readonly MAX_PRICE_CHANGE = 0.20; // 20%
  
  // Calculate price elasticity for a given time period
  async calculatePriceElasticity(
    planId: string, 
    startDate: Date, 
    endDate: Date
  ): Promise<PriceElasticityResult[]> {
    const priceHistory = await prisma.priceHistory.findMany({
      where: {
        planId,
        effectiveFrom: { gte: startDate },
        effectiveTo: { lte: endDate }
      },
      orderBy: { effectiveFrom: 'asc' }
    });

    const subscriptionData = await prisma.subscription.groupBy({
      by: ['planId'],
      where: {
        planId,
        createdAt: { gte: startDate, lte: endDate }
      },
      _count: true,
      _sum: { basePrice: true }
    });

    // Calculate price elasticity using midpoint formula
    const results: PriceElasticityResult[] = [];
    for (let i = 1; i < priceHistory.length; i++) {
      const p1 = priceHistory[i - 1].price;
      const p2 = priceHistory[i].price;
      const q1 = subscriptionData[i - 1]?._count || 0;
      const q2 = subscriptionData[i]?._count || 0;

      const elasticity = ((q2 - q1) / ((q2 + q1) / 2)) / ((p2 - p1) / ((p2 + p1) / 2));
      results.push({ elasticity, date: priceHistory[i].effectiveFrom });
    }

    return results;
  }

  // Price test management
  async startPriceTest(
    planId: string, 
    variants: Array<{ price: number; name: string }>
  ): Promise<PriceTest & { variants: PriceTestVariant[] }> {
    const plan = await prisma.pricingPlan.findUnique({ where: { id: planId } });
    if (!plan) throw new Error('Plan not found');

    // Create price test
    const test = await prisma.priceTest.create({
      data: {
        planId,
        name: `Price Test ${new Date().toISOString()}`,
        startDate: new Date(),
        status: 'ACTIVE',
        targetMetric: 'conversion_rate',
        minConfidence: 0.95,
        variants: {
          create: [
            // Control variant
            {
              price: plan.basePrice,
              name: 'Control',
              isControl: true
            },
            // Test variants
            ...variants.map(v => ({
              price: v.price,
              name: v.name,
              isControl: false
            }))
          ]
        }
      },
      include: {
        variants: true
      }
    });

    return test;
  }

  // Market analysis and benchmarking
  async analyzeMarketPosition(planId: string): Promise<MarketPositionResult | null> {
    const plan = await prisma.pricingPlan.findUnique({
      where: { id: planId },
      include: { PlanFeatureAssociation: true }
    });

    if (!plan) throw new Error('Plan not found');

    // Get market benchmarks
    const benchmark = await this.getMarketBenchmark(plan.marketSegment);
    if (!benchmark) return null;

    // Calculate relative position
    const percentile = (plan.basePrice - benchmark.minPrice) / 
      (benchmark.maxPrice - benchmark.minPrice);

    return {
      currentPrice: plan.basePrice,
      marketAverage: benchmark.avgPrice,
      marketMedian: benchmark.medianPrice,
      percentile,
      recommendation: this.getPriceRecommendation(plan, benchmark)
    };
  }

  // Price optimization
  async optimizePrice(planId: string): Promise<{
    currentPrice: number;
    recommendedPrice: number;
    factors: PriceOptimizationFactors;
  }> {
    const [elasticity, marketPosition, churnRisk] = await Promise.all([
      this.calculatePriceElasticity(
        planId, 
        new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), 
        new Date()
      ),
      this.analyzeMarketPosition(planId),
      this.getChurnRisk(planId)
    ]);

    const plan = await prisma.pricingPlan.findUnique({
      where: { id: planId },
      include: { PlanFeatureAssociation: true }
    });

    if (!plan || !marketPosition) throw new Error('Plan or market data not found');

    // Calculate optimal price using multiple factors
    const averageElasticity = elasticity.reduce((sum, e) => sum + e.elasticity, 0) / elasticity.length;
    const marketPressure = (marketPosition.marketMedian - plan.basePrice) / marketPosition.marketMedian;
    const churnFactor = 1 - (churnRisk.probability || 0);

    // Weighted optimization formula
    const optimalPrice = plan.basePrice * (
      1 + // Base price
      (marketPressure * 0.3) + // Market position influence
      (averageElasticity * -0.2) + // Elasticity influence (inverse)
      (churnFactor * 0.1) // Churn risk influence
    );

    return {
      currentPrice: plan.basePrice,
      recommendedPrice: Math.round(optimalPrice * 100) / 100,
      factors: {
        elasticity: averageElasticity,
        marketPressure,
        churnRisk: churnRisk.probability
      }
    };
  }

  // Revenue simulation
  async simulateRevenue(
    planId: string, 
    priceChange: number, 
    months: number = 12
  ): Promise<RevenueProjection[]> {
    const plan = await prisma.pricingPlan.findUnique({
      where: { id: planId },
      include: {
        subscriptions: {
          where: { status: 'ACTIVE' }
        }
      }
    });

    if (!plan) throw new Error('Plan not found');

    const elasticity = await this.calculatePriceElasticity(
      planId,
      new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
      new Date()
    );

    const avgElasticity = elasticity.reduce((sum, e) => sum + e.elasticity, 0) / elasticity.length;
    const currentSubscribers = plan.subscriptions.length;
    const currentRevenue = currentSubscribers * plan.basePrice;

    // Project revenue changes
    const projections: RevenueProjection[] = [];
    let cumulativeSubscribers = currentSubscribers;
    
    for (let month = 1; month <= months; month++) {
      // Apply elasticity effect
      const subscriberChange = cumulativeSubscribers * avgElasticity * (priceChange / plan.basePrice);
      cumulativeSubscribers += subscriberChange;

      // Calculate churn based on price sensitivity
      const churnRate = Math.max(0, -avgElasticity * (priceChange / plan.basePrice));
      const churnedSubscribers = cumulativeSubscribers * churnRate;
      cumulativeSubscribers -= churnedSubscribers;

      const monthlyRevenue = cumulativeSubscribers * (plan.basePrice + priceChange);

      projections.push({
        month,
        subscribers: Math.round(cumulativeSubscribers),
        revenue: Math.round(monthlyRevenue * 100) / 100,
        churnRate: Math.round(churnRate * 100) / 100
      });
    }

    return projections;
  }

  // Private helper methods
  private async getChurnRisk(planId: string): Promise<ChurnRisk> {
    // Implement churn risk calculation based on historical data
    // This is a placeholder implementation
    return {
      probability: 0.1,
      factors: {
        priceElasticity: 0.3,
        competitorPricing: 0.2,
        customerSatisfaction: 0.5
      }
    };
  }

  private async getMarketBenchmark(segment?: string): Promise<MarketBenchmark> {
    // Implement market benchmark retrieval
    // This is a placeholder implementation
    return {
      minPrice: 10,
      maxPrice: 100,
      avgPrice: 50,
      medianPrice: 45,
      segment: segment || 'default',
      productType: 'saas',
      collectedAt: new Date()
    };
  }

  private getPriceRecommendation(plan: PricingPlan, benchmark: MarketBenchmark): string {
    const priceDiff = (plan.basePrice - benchmark.medianPrice) / benchmark.medianPrice;
    
    if (priceDiff < -0.2) return 'Consider increasing price to align with market';
    if (priceDiff > 0.2) return 'Consider optimizing price for market competitiveness';
    return 'Price is well-aligned with market';
  }

  // Update price optimization for a plan
  async updatePriceOptimization(planId: string): Promise<PriceOptimizationResult | null> {
    const plan = await prisma.pricingPlan.findUnique({
      where: { id: planId },
      include: {
        priceHistory: {
          orderBy: { createdAt: 'desc' },
          take: 100
        },
        subscriptions: {
          where: {
            status: 'ACTIVE'
          },
          include: {
            customer: true
          }
        }
      }
    });

    if (!plan) throw new Error('Plan not found');

    // Check if we have enough data points
    if (plan.priceHistory.length < this.MIN_DATA_POINTS) {
      return null;
    }

    // Get market conditions
    const marketConditions = await this.getMarketConditions(plan);
    
    // Calculate price elasticity
    const elasticity = await this.calculatePriceElasticity(
      planId,
      new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
      new Date()
    );
    
    // Analyze customer segments
    const segmentAnalysis = await this.analyzeCustomerSegments(plan.subscriptions);
    
    // Calculate optimal price
    const optimizationResult = this.calculateOptimalPrice({
      plan,
      marketConditions,
      elasticity,
      segmentAnalysis
    });

    // Apply price change if significant
    if (this.shouldUpdatePrice(plan.basePrice, optimizationResult.recommendedPrice)) {
      await this.applyPriceUpdate(plan.id, optimizationResult);
    }

    return optimizationResult;
  }

  // Get current market conditions
  private async getMarketConditions(plan: PricingPlan): Promise<MarketCondition> {
    // In a real implementation, this would integrate with external APIs
    // and market data sources to get competitor prices and market indicators
    
    // Placeholder implementation
    return {
      competitorPrices: [plan.basePrice * 0.9, plan.basePrice * 1.1],
      marketDemand: 0.7, // Example value
      seasonality: this.calculateSeasonality()
    };
  }

  // Analyze customer segments
  private async analyzeCustomerSegments(subscriptions: Array<Subscription & {
    customer: any; // Replace with proper Customer type
  }>) {
    // Group customers by relevant characteristics
    const segments = subscriptions.reduce((acc, sub) => {
      const segment = this.determineCustomerSegment(sub.customer);
      if (!acc[segment]) acc[segment] = [];
      acc[segment].push(sub);
      return acc;
    }, {} as Record<string, typeof subscriptions>);

    // Calculate segment-specific metrics
    return Object.entries(segments).map(([segment, subs]) => ({
      segment,
      size: subs.length,
      averageRevenue: subs.reduce((sum, sub) => sum + sub.amount, 0) / subs.length,
      churnRate: this.calculateSegmentChurnRate(subs),
      priceElasticity: this.calculateSegmentPriceElasticity(subs)
    }));
  }

  // Calculate optimal price based on all factors
  private calculateOptimalPrice({
    plan,
    marketConditions,
    elasticity,
    segmentAnalysis
  }: {
    plan: PricingPlan & { priceHistory: PriceHistory[] };
    marketConditions: MarketCondition;
    elasticity: number;
    segmentAnalysis: any[];
  }): PriceOptimizationResult {
    // Weight factors based on confidence and importance
    const weights = {
      historicalPerformance: 0.3,
      marketConditions: 0.3,
      customerSegment: 0.2,
      elasticity: 0.2
    };

    // Calculate price recommendations for each factor
    const historicalFactor = this.calculateHistoricalPriceFactor(plan.priceHistory);
    const marketFactor = this.calculateMarketPriceFactor(marketConditions);
    const segmentFactor = this.calculateSegmentPriceFactor(segmentAnalysis);
    const elasticityFactor = this.calculateElasticityPriceFactor(elasticity, plan.basePrice);

    // Combine factors with weights
    const recommendedPrice = 
      plan.basePrice * (
        (historicalFactor * weights.historicalPerformance) +
        (marketFactor * weights.marketConditions) +
        (segmentFactor * weights.customerSegment) +
        (elasticityFactor * weights.elasticity)
      );

    // Calculate confidence based on data quality and consistency
    const confidence = this.calculateConfidenceScore({
      historicalDataPoints: plan.priceHistory.length,
      elasticity,
      marketConditions,
      segmentAnalysis
    });

    return {
      recommendedPrice: Math.round(recommendedPrice * 100) / 100,
      confidence,
      factors: {
        historicalPerformance: historicalFactor,
        marketConditions: marketFactor,
        customerSegment: segmentFactor,
        elasticity: elasticityFactor
      }
    };
  }

  // Helper methods
  private calculateSeasonality(): number {
    const date = new Date();
    const month = date.getMonth();
    const dayOfWeek = date.getDay();
    
    // Simple seasonality calculation
    // In a real implementation, this would use historical data
    const monthFactor = Math.sin((month / 12) * 2 * Math.PI) * 0.1 + 0.9;
    const weekFactor = (dayOfWeek >= 1 && dayOfWeek <= 5) ? 1 : 0.8;
    
    return monthFactor * weekFactor;
  }

  private determineCustomerSegment(customer: any): string {
    // Implement customer segmentation logic
    // This could be based on various factors like:
    // - Usage patterns
    // - Company size
    // - Industry
    // - Geographic location
    return 'default';
  }

  private calculateSegmentChurnRate(subscriptions: Subscription[]): number {
    // Implement churn rate calculation for segment
    return 0.1; // Placeholder
  }

  private calculateSegmentPriceElasticity(subscriptions: Subscription[]): number {
    // Implement segment-specific price elasticity calculation
    return -1.5; // Placeholder
  }

  private calculateHistoricalPriceFactor(priceHistory: PriceHistory[]): number {
    if (priceHistory.length === 0) return 1;

    // Calculate trend from historical performance
    const recentPrices = priceHistory.slice(0, 12); // Last 12 price points
    const trend = recentPrices.reduce((acc, price, i) => {
      if (i === 0) return acc;
      const change = price.price / recentPrices[i - 1].price;
      return acc + change;
    }, 0) / (recentPrices.length - 1);

    return trend;
  }

  private calculateMarketPriceFactor(conditions: MarketCondition): number {
    const avgCompetitorPrice = conditions.competitorPrices.reduce((a, b) => a + b, 0) / 
      conditions.competitorPrices.length;
    
    // Adjust based on market demand and seasonality
    return (
      (avgCompetitorPrice * 0.6) + 
      (conditions.marketDemand * 0.2) + 
      (conditions.seasonality * 0.2)
    );
  }

  private calculateSegmentPriceFactor(segmentAnalysis: any[]): number {
    // Calculate weighted average of segment-specific price factors
    const totalSize = segmentAnalysis.reduce((sum, segment) => sum + segment.size, 0);
    
    return segmentAnalysis.reduce((factor, segment) => {
      const weight = segment.size / totalSize;
      return factor + (weight * (1 + segment.priceElasticity));
    }, 0);
  }

  private calculateElasticityPriceFactor(elasticity: number, currentPrice: number): number {
    // Use elasticity to determine optimal price movement
    if (elasticity === 0) return 1;
    
    // If elasticity is high (negative), suggest price decrease
    // If elasticity is low (negative), suggest price increase
    const adjustment = -0.1 * elasticity;
    return 1 + Math.max(-this.MAX_PRICE_CHANGE, Math.min(this.MAX_PRICE_CHANGE, adjustment));
  }

  private calculateConfidenceScore(params: {
    historicalDataPoints: number;
    elasticity: number;
    marketConditions: MarketCondition;
    segmentAnalysis: any[];
  }): number {
    const factors = [
      // Data quantity factor
      Math.min(params.historicalDataPoints / this.MIN_DATA_POINTS, 1),
      
      // Elasticity confidence
      Math.abs(params.elasticity) > 0.1 ? 0.8 : 0.4,
      
      // Market data quality
      params.marketConditions.competitorPrices.length > 0 ? 0.7 : 0.3,
      
      // Segment analysis quality
      params.segmentAnalysis.length > 0 ? 0.9 : 0.5
    ];

    return factors.reduce((a, b) => a + b, 0) / factors.length;
  }

  private shouldUpdatePrice(currentPrice: number, recommendedPrice: number): boolean {
    const priceChange = Math.abs(recommendedPrice - currentPrice) / currentPrice;
    return priceChange >= this.PRICE_CHANGE_THRESHOLD;
  }

  private async applyPriceUpdate(planId: string, optimization: PriceOptimizationResult) {
    await prisma.pricingPlan.update({
      where: { id: planId },
      data: {
        basePrice: optimization.recommendedPrice,
        priceHistory: {
          create: {
            price: optimization.recommendedPrice,
            reason: 'Dynamic pricing optimization',
            metadata: {
              confidence: optimization.confidence,
              factors: optimization.factors
            }
          }
        }
      }
    });
  }
} 