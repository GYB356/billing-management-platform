import { prisma } from '@/lib/prisma';
import { PriceTest, PriceTestVariant, Plan } from '@prisma/client';
import { DynamicPricingEngine } from './DynamicPricingEngine';

export class PriceTestingService {
  private dynamicPricingEngine: DynamicPricingEngine;

  constructor() {
    this.dynamicPricingEngine = new DynamicPricingEngine();
  }

  // Create a new price test
  async createPriceTest(planId: string, options: {
    name: string;
    description?: string;
    variants: Array<{
      name: string;
      priceMultiplier: number;
      trafficAllocation: number;
    }>;
    duration: number; // days
  }) {
    // Validate total traffic allocation
    const totalAllocation = options.variants.reduce(
      (sum, variant) => sum + variant.trafficAllocation,
      0
    );
    if (totalAllocation !== 100) {
      throw new Error('Total traffic allocation must equal 100%');
    }

    const plan = await prisma.plan.findUnique({
      where: { id: planId }
    });
    if (!plan) throw new Error('Plan not found');

    // Create price test
    const priceTest = await prisma.priceTest.create({
      data: {
        planId,
        name: options.name,
        description: options.description,
        status: 'ACTIVE',
        startDate: new Date(),
        endDate: new Date(Date.now() + options.duration * 24 * 60 * 60 * 1000),
        variants: {
          create: options.variants.map(variant => ({
            name: variant.name,
            price: plan.currentPrice * variant.priceMultiplier,
            trafficAllocation: variant.trafficAllocation,
            conversionCount: 0,
            impressionCount: 0
          }))
        }
      },
      include: {
        variants: true
      }
    });

    return priceTest;
  }

  // Get price variant for a customer
  async getPriceVariant(planId: string, customerId: string): Promise<{
    price: number;
    variantId: string;
    testId: string;
  }> {
    const activeTest = await prisma.priceTest.findFirst({
      where: {
        planId,
        status: 'ACTIVE',
        endDate: {
          gt: new Date()
        }
      },
      include: {
        variants: true
      }
    });

    if (!activeTest) {
      const plan = await prisma.plan.findUnique({
        where: { id: planId }
      });
      if (!plan) throw new Error('Plan not found');
      
      return {
        price: plan.currentPrice,
        variantId: '',
        testId: ''
      };
    }

    // Deterministic variant selection based on customer ID
    const variantIndex = this.getCustomerVariantIndex(
      customerId,
      activeTest.variants,
      activeTest.id
    );
    const variant = activeTest.variants[variantIndex];

    // Record impression
    await prisma.priceTestVariant.update({
      where: { id: variant.id },
      data: {
        impressionCount: {
          increment: 1
        }
      }
    });

    return {
      price: variant.price,
      variantId: variant.id,
      testId: activeTest.id
    };
  }

  // Record conversion for a variant
  async recordConversion(variantId: string) {
    await prisma.priceTestVariant.update({
      where: { id: variantId },
      data: {
        conversionCount: {
          increment: 1
        }
      }
    });
  }

  // Analyze test results
  async analyzeTestResults(testId: string) {
    const test = await prisma.priceTest.findUnique({
      where: { id: testId },
      include: {
        variants: true,
        plan: true
      }
    });
    if (!test) throw new Error('Test not found');

    const results = test.variants.map(variant => ({
      name: variant.name,
      price: variant.price,
      conversionRate: variant.impressionCount > 0
        ? (variant.conversionCount / variant.impressionCount) * 100
        : 0,
      revenue: variant.price * variant.conversionCount
    }));

    // Calculate statistical significance
    const controlVariant = results[0];
    const testResults = results.slice(1).map(variant => ({
      ...variant,
      improvement: ((variant.conversionRate - controlVariant.conversionRate) / controlVariant.conversionRate) * 100,
      significanceLevel: this.calculateSignificance(
        controlVariant.conversionRate,
        variant.conversionRate,
        controlVariant.conversionCount,
        variant.conversionCount
      )
    }));

    // Find winning variant
    const winningVariant = testResults.reduce((winner, variant) => {
      if (
        variant.revenue > winner.revenue &&
        variant.significanceLevel >= 0.95
      ) {
        return variant;
      }
      return winner;
    }, controlVariant);

    return {
      testId,
      planId: test.planId,
      results: testResults,
      winningVariant,
      recommendation: winningVariant.price !== test.plan.currentPrice
        ? {
            action: 'UPDATE_PRICE',
            newPrice: winningVariant.price,
            expectedImprovement: ((winningVariant.revenue - controlVariant.revenue) / controlVariant.revenue) * 100
          }
        : {
            action: 'MAINTAIN_PRICE'
          }
    };
  }

  // Apply test results
  async applyTestResults(testId: string) {
    const analysis = await this.analyzeTestResults(testId);
    
    if (analysis.recommendation.action === 'UPDATE_PRICE') {
      // Update plan price
      await prisma.plan.update({
        where: { id: analysis.planId },
        data: {
          currentPrice: analysis.recommendation.newPrice,
          priceHistory: {
            create: {
              price: analysis.recommendation.newPrice,
              reason: `Price test ${testId} results applied`,
              metadata: {
                testId,
                improvement: analysis.recommendation.expectedImprovement
              }
            }
          }
        }
      });

      // Close the test
      await prisma.priceTest.update({
        where: { id: testId },
        data: {
          status: 'COMPLETED',
          results: analysis
        }
      });

      // Trigger dynamic pricing engine update
      await this.dynamicPricingEngine.updatePriceOptimization(analysis.planId);
    }

    return analysis;
  }

  // Helper functions
  private getCustomerVariantIndex(
    customerId: string,
    variants: PriceTestVariant[],
    testId: string
  ): number {
    // Create a deterministic hash of customer ID and test ID
    const hash = this.hashString(`${customerId}-${testId}`);
    const normalized = hash / Math.pow(2, 32); // Normalize to 0-1
    
    // Select variant based on traffic allocation
    let cumulative = 0;
    for (let i = 0; i < variants.length; i++) {
      cumulative += variants[i].trafficAllocation / 100;
      if (normalized <= cumulative) return i;
    }
    return variants.length - 1;
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  private calculateSignificance(
    control: number,
    variant: number,
    controlN: number,
    variantN: number
  ): number {
    // Implement z-test for proportions
    const p1 = control / 100;
    const p2 = variant / 100;
    const p = (p1 * controlN + p2 * variantN) / (controlN + variantN);
    const se = Math.sqrt(p * (1 - p) * (1/controlN + 1/variantN));
    const z = Math.abs((p1 - p2) / se);
    
    // Convert z-score to p-value (one-tailed)
    return 0.5 * (1 + this.erf(z / Math.sqrt(2)));
  }

  private erf(x: number): number {
    // Error function approximation
    const t = 1.0 / (1.0 + 0.5 * Math.abs(x));
    const tau = t * Math.exp(
      -x * x - 1.26551223 +
      t * (1.00002368 +
      t * (0.37409196 +
      t * (0.09678418 +
      t * (-0.18628806 +
      t * (0.27886807 +
      t * (-1.13520398 +
      t * (1.48851587 +
      t * (-0.82215223 +
      t * 0.17087277)))))))))
    );
    return x >= 0 ? 1 - tau : tau - 1;
  }
} 