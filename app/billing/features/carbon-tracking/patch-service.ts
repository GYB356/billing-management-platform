import { prisma } from '@/lib/prisma';
import { createEvent } from '@/lib/events';

interface CarbonTrackingConfig {
  enabled: boolean;
  patchApiKey: string;
  defaultCurrency: string;
  autoOffset: boolean;
  estimateMultiplier: number;
}

export const defaultConfig: CarbonTrackingConfig = {
  enabled: true,
  patchApiKey: process.env.PATCH_API_KEY || '',
  defaultCurrency: 'USD',
  autoOffset: false,
  estimateMultiplier: 1.1, // Add 10% buffer to estimates
};

interface EstimateData {
  amount: number;
  currency: string;
  category: string;
}

interface PatchApiResponse {
  id: string;
  estimatedEmissions: number;
  offsetCost: number;
  rawEstimate: any;
}

export class PatchService {
  private organizationId: string;
  private apiKey: string;
  private baseUrl: string;
  private config: CarbonTrackingConfig;

  constructor(organizationId: string, config: CarbonTrackingConfig = defaultConfig) {
    this.organizationId = organizationId;
    this.apiKey = process.env.PATCH_API_KEY || '';
    this.baseUrl = process.env.PATCH_API_URL || 'https://api.patch.io/v1';
    this.config = config;
    if (!config.enabled) {
      throw new Error('Carbon tracking is not enabled');
    }
    if (!config.patchApiKey) {
      throw new Error('Patch API key is required');
    }
  }

  private async makeRequest(endpoint: string, method: string, data?: any) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: data ? JSON.stringify(data) : undefined,
    });

    if (!response.ok) {
      throw new Error(`Patch API error: ${response.statusText}`);
    }

    return response.json();
  }

  async estimateTransactionEmissions(data: EstimateData) {
    try {
      const patchResponse = await this.makeRequest('/estimates', 'POST', {
        amount: data.amount,
        currency: data.currency,
        category: data.category,
      });

      const estimate = await prisma.carbonEstimate.create({
        data: {
          organizationId: this.organizationId,
          amount: data.amount,
          currency: data.currency,
          category: data.category,
          estimatedEmissions: patchResponse.estimated_emissions,
          offsetCost: patchResponse.offset_cost,
          status: 'ESTIMATED',
          rawEstimate: patchResponse,
        },
      });

      // Create an event
      await createEvent({
        organizationId: this.organizationId,
        eventType: 'carbon.estimate_created',
        resourceType: 'carbon_estimate',
        resourceId: estimate.id,
        severity: 'INFO',
        metadata: {
          amount: data.amount,
          currency: data.currency,
          category: data.category,
          estimatedEmissions: patchResponse.estimated_emissions,
          offsetCost: patchResponse.offset_cost,
        },
      });

      return estimate;
    } catch (error) {
      console.error('Error estimating emissions:', error);
      throw error;
    }
  }

  async purchaseOffsets(estimateId: string) {
    try {
      const estimate = await prisma.carbonEstimate.findUnique({
        where: { id: estimateId },
      });

      if (!estimate) {
        throw new Error('Estimate not found');
      }

      const patchResponse = await this.makeRequest('/orders', 'POST', {
        estimate_id: estimate.rawEstimate.id,
      });

      const updatedEstimate = await prisma.carbonEstimate.update({
        where: { id: estimateId },
        data: {
          status: 'OFFSET',
          offsetOrderId: patchResponse.id,
          offsetPurchasedAt: new Date(),
          rawOrder: patchResponse,
        },
      });

      // Create an event
      await createEvent({
        organizationId: this.organizationId,
        eventType: 'carbon.offset_purchased',
        resourceType: 'carbon_estimate',
        resourceId: estimateId,
        severity: 'INFO',
        metadata: {
          orderId: patchResponse.id,
          amount: estimate.amount,
          currency: estimate.currency,
          category: estimate.category,
          estimatedEmissions: estimate.estimatedEmissions,
          offsetCost: estimate.offsetCost,
        },
      });

      return updatedEstimate;
    } catch (error) {
      console.error('Error purchasing offsets:', error);
      throw error;
    }
  }

  async getMetrics() {
    try {
      const [totalEmissions, totalOffsets, estimates] = await Promise.all([
        prisma.carbonEstimate.aggregate({
          _sum: { estimatedEmissions: true },
          where: { organizationId: this.organizationId },
        }),
        prisma.carbonEstimate.aggregate({
          _sum: { offsetCost: true },
          where: { 
            organizationId: this.organizationId,
            status: 'OFFSET',
          },
        }),
        prisma.carbonEstimate.findMany({
          where: { organizationId: this.organizationId },
          orderBy: { createdAt: 'desc' },
          take: 10,
        }),
      ]);

      return {
        totalEmissions: totalEmissions._sum.estimatedEmissions || 0,
        totalOffsets: totalOffsets._sum.offsetCost || 0,
        recentEstimates: estimates,
      };
    } catch (error) {
      console.error('Error fetching metrics:', error);
      throw error;
    }
  }

  /**
   * Auto-offset carbon emissions if enabled
   */
  async handleAutoOffset(estimateId: string) {
    if (!this.config.autoOffset) return;

    try {
      await this.purchaseOffsets(estimateId);
    } catch (error) {
      console.error('Error auto-offsetting carbon emissions:', error);
      // Don't throw the error - auto-offset failures shouldn't block the main flow
    }
  }
} 