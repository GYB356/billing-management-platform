import OpenAI from 'openai';
import { getRevenueMetrics } from './revenue-metrics';
import { getStripeMetrics } from './stripe-monitor';
import logger from '@/lib/logger';
import { prisma } from '@/lib/prisma';

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      OPENAI_API_KEY: string;
    }
  }
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface RevenueInsight {
  insight: string;
  recommendation: string;
  impact: 'high' | 'medium' | 'low';
  category: 'pricing' | 'retention' | 'acquisition' | 'product';
}

export async function generateRevenueInsights(): Promise<RevenueInsight[]> {
  try {
    // Gather all relevant metrics
    const [revenueMetrics, stripeMetrics] = await Promise.all([
      getRevenueMetrics(),
      getStripeMetrics(30),
    ]);

    // Prepare data for AI analysis
    const analysisData = {
      mrr: revenueMetrics.mrr,
      churnRate: revenueMetrics.churnRate,
      ltv: revenueMetrics.ltv,
      cac: revenueMetrics.cac,
      averageTransactionValue: stripeMetrics.averageTransactionValue,
      disputeRate: stripeMetrics.disputeRate,
      failureRate: stripeMetrics.failedPayments / 
        (stripeMetrics.successfulPayments + stripeMetrics.failedPayments) * 100,
    };

    // Generate insights using OpenAI
    const prompt = `
      Analyze the following SaaS metrics and provide 3 actionable insights with recommendations:
      
      MRR: $${analysisData.mrr}
      Churn Rate: ${analysisData.churnRate}%
      LTV: $${analysisData.ltv}
      CAC: $${analysisData.cac}
      Average Transaction Value: $${analysisData.averageTransactionValue}
      Dispute Rate: ${analysisData.disputeRate}%
      Payment Failure Rate: ${analysisData.failureRate}%
      
      For each insight, provide:
      1. The observation
      2. A specific recommendation
      3. The potential impact (high/medium/low)
      4. Category (pricing/retention/acquisition/product)
      
      Format as JSON array.
    `;

    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        {
          role: "system",
          content: "You are a SaaS revenue optimization expert. Analyze the metrics and provide actionable insights."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
    });

    const response = JSON.parse(completion.choices[0].message.content || '{"insights": []}');
    return response.insights;

  } catch (error) {
    logger.error('Failed to generate revenue insights', error as Error);
    return [
      {
        insight: "Unable to generate AI insights at this time",
        recommendation: "Please try again later or contact support",
        impact: "low" as const,
        category: "product" as const,
      },
    ];
  }
}

export async function optimizePricingTiers(): Promise<{
  current: Record<string, number>;
  recommended: Record<string, number>;
  reasoning: string;
}> {
  try {
    const metrics = await getRevenueMetrics();
    
    // Get current pricing tiers
    const plans = await prisma.plan.findMany({
      select: {
        name: true,
        price: true,
        features: true,
      },
    });

    const currentPricing = plans.reduce((acc, plan) => ({
      ...acc,
      [plan.name]: plan.price,
    }), {} as Record<string, number>);

    // Generate pricing recommendations using OpenAI
    const prompt = `
      Analyze the following metrics and current pricing tiers to recommend optimal pricing:
      
      Current Metrics:
      - MRR: $${metrics.mrr}
      - Average LTV: $${metrics.ltv}
      - CAC: $${metrics.cac}
      - Churn Rate: ${metrics.churnRate}%
      
      Current Pricing Tiers:
      ${JSON.stringify(currentPricing, null, 2)}
      
      Provide:
      1. Recommended pricing for each tier
      2. Detailed reasoning for the changes
      
      Format as JSON with 'recommended' and 'reasoning' fields.
    `;

    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        {
          role: "system",
          content: "You are a SaaS pricing strategy expert. Analyze the metrics and provide pricing recommendations."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
    });

    const response = JSON.parse(completion.choices[0].message.content || '{"recommended": {}, "reasoning": ""}');
    
    return {
      current: currentPricing,
      recommended: response.recommended,
      reasoning: response.reasoning,
    };

  } catch (error) {
    logger.error('Failed to optimize pricing tiers', error as Error);
    throw error;
  }
} 