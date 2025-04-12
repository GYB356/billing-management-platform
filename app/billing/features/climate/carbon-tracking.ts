import Patch from '@patch-technology/patch';

export interface CarbonTrackingConfig {
  enabled: boolean;
  patchApiKey: string | undefined;
  defaultOffsetPercentage: number;
  trackingMetrics: CarbonMetric[];
}

export interface CarbonMetric {
  name: string;
  type: 'api_calls' | 'storage' | 'compute' | 'transfer';
  carbonMultiplier: number; // kgCO2e per unit
}

export const defaultConfig: CarbonTrackingConfig = {
  enabled: true,
  patchApiKey: process.env.PATCH_API_KEY,
  defaultOffsetPercentage: 100, // 100% offset by default
  trackingMetrics: [
    {
      name: 'API Calls',
      type: 'api_calls',
      carbonMultiplier: 0.000004 // 4g CO2e per API call (example)
    },
    {
      name: 'Storage',
      type: 'storage',
      carbonMultiplier: 0.000175 // 175g CO2e per GB per month (example)
    },
    {
      name: 'Data Transfer',
      type: 'transfer',
      carbonMultiplier: 0.000081 // 81g CO2e per GB transferred (example)
    }
  ]
};

export class CarbonTracker {
  private patch: Patch;
  private config: CarbonTrackingConfig;

  constructor(config: CarbonTrackingConfig = defaultConfig) {
    this.config = config;
    if (config.enabled && config.patchApiKey) {
      this.patch = new Patch(config.patchApiKey);
    } else {
      throw new Error('Carbon tracking is enabled but Patch API key is missing');
    }
  }

  async trackUsage(metric: CarbonMetric, quantity: number): Promise<void> {
    if (!this.config.enabled) return;

    const carbonEmissions = quantity * metric.carbonMultiplier;
    
    try {
      const estimate = await this.patch.estimates.create({
        type: 'carbon_footprint',
        carbon_grams: carbonEmissions * 1000, // Convert kg to g
        description: `Carbon footprint for ${metric.name}`,
      });

      if (this.config.defaultOffsetPercentage > 0) {
        await this.patch.orders.create({
          estimate_id: estimate.id,
          quantity: (estimate.carbon_grams * this.config.defaultOffsetPercentage) / 100,
        });
      }
    } catch (error) {
      console.error('Error tracking carbon emissions:', error);
      // Don't throw - we don't want to block the main application flow
    }
  }

  async getFootprint(startDate: Date, endDate: Date) {
    if (!this.config.enabled) return null;

    try {
      const estimates = await this.patch.estimates.list({
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
      });

      return {
        total_emissions: estimates.reduce((sum, est) => sum + est.carbon_grams, 0) / 1000, // Convert to kg
        estimates: estimates,
      };
    } catch (error) {
      console.error('Error fetching carbon footprint:', error);
      return null;
    }
  }
} 