import Stripe from 'stripe';

export interface BNPLConfig {
  enabled: boolean;
  provider: 'stripe' | 'finbox' | 'rutter';
  minimumAmount: number;
  maximumAmount: number;
  supportedCurrencies: string[];
}

export interface FinancingOffer {
  id: string;
  amount: number;
  currency: string;
  terms: {
    installments: number;
    interval: 'week' | 'month';
    amount_per_installment: number;
  };
  apr: number;
  total_cost: number;
}

export const defaultConfig: BNPLConfig = {
  enabled: true,
  provider: 'stripe',
  minimumAmount: 50,
  maximumAmount: 10000,
  supportedCurrencies: ['usd', 'eur', 'gbp'],
};

export class BNPLService {
  private stripe: Stripe;
  private config: BNPLConfig;

  constructor(stripeSecretKey: string, config: BNPLConfig = defaultConfig) {
    this.config = config;
    if (config.enabled) {
      this.stripe = new Stripe(stripeSecretKey, {
        apiVersion: '2023-10-16',
      });
    } else {
      throw new Error('BNPL service is not enabled');
    }
  }

  async checkEligibility(
    customerId: string,
    amount: number,
    currency: string
  ): Promise<boolean> {
    if (!this.config.enabled) return false;
    if (amount < this.config.minimumAmount || amount > this.config.maximumAmount) {
      return false;
    }
    if (!this.config.supportedCurrencies.includes(currency.toLowerCase())) {
      return false;
    }

    try {
      const customer = await this.stripe.customers.retrieve(customerId);
      if (!customer || customer.deleted) return false;

      // Check if customer has payment method
      const paymentMethods = await this.stripe.paymentMethods.list({
        customer: customerId,
        type: 'card',
      });

      return paymentMethods.data.length > 0;
    } catch (error) {
      console.error('Error checking BNPL eligibility:', error);
      return false;
    }
  }

  async getFinancingOffers(
    amount: number,
    currency: string
  ): Promise<FinancingOffer[]> {
    if (!this.config.enabled) return [];

    // Example financing plans - in production, these would come from Stripe Capital API
    const plans: FinancingOffer[] = [
      {
        id: 'plan_3months',
        amount,
        currency,
        terms: {
          installments: 3,
          interval: 'month',
          amount_per_installment: Math.ceil(amount / 3),
        },
        apr: 0, // 0% APR for 3 months
        total_cost: amount,
      },
      {
        id: 'plan_6months',
        amount,
        currency,
        terms: {
          installments: 6,
          interval: 'month',
          amount_per_installment: Math.ceil((amount * 1.05) / 6), // 5% fee
        },
        apr: 10, // 10% APR
        total_cost: Math.ceil(amount * 1.05),
      },
    ];

    return plans;
  }

  async createFinancingPlan(
    customerId: string,
    offerId: string,
    amount: number,
    currency: string
  ) {
    if (!this.config.enabled) {
      throw new Error('BNPL service is not enabled');
    }

    try {
      // Create a payment intent with deferred payment
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency,
        customer: customerId,
        payment_method_types: ['card'],
        payment_method_options: {
          card: {
            installments: {
              enabled: true,
            },
          },
        },
        metadata: {
          financing_plan: offerId,
        },
      });

      return paymentIntent;
    } catch (error) {
      console.error('Error creating financing plan:', error);
      throw error;
    }
  }
} 