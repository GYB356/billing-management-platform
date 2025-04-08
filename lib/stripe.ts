import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set');
}

// Initialize Stripe with your secret key
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-08-16', // Use the consistent API version
});

// Helper function to format amount for display
export function formatAmount(amount: number, currency: string = 'usd'): string {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  });
  
  return formatter.format(amount / 100);
}

// Helper function to format to cents (from dollars to cents)
export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

// Get Stripe price ID based on plan identifier
export function getStripePriceId(planId: string): string {
  const priceMap: Record<string, string> = {
    basic: process.env.STRIPE_BASIC_PRICE_ID || '',
    pro: process.env.STRIPE_PRO_PRICE_ID || '',
    enterprise: process.env.STRIPE_ENTERPRISE_PRICE_ID || '',
  };
  
  return priceMap[planId] || '';
}

/**
 * Get the display name of a plan
 */
export function getPlanDisplayName(planId: string): string {
  const priceMap: Record<string, string> = {
    'price_basic_monthly': 'Basic (Monthly)',
    'price_basic_yearly': 'Basic (Yearly)',
    'price_standard_monthly': 'Standard (Monthly)',
    'price_standard_yearly': 'Standard (Yearly)',
    'price_premium_monthly': 'Premium (Monthly)',
    'price_premium_yearly': 'Premium (Yearly)',
    'price_enterprise_monthly': 'Enterprise (Monthly)',
    'price_enterprise_yearly': 'Enterprise (Yearly)',
  };
  
  return priceMap[planId] || '';
}

/**
 * Create a customer in Stripe
 */
export async function createStripeCustomer(userId: string, email: string, name?: string) {
  try {
    const customer = await stripe.customers.create({
      email,
      name,
      metadata: {
        userId,
      },
    });
    
    return customer;
  } catch (error) {
    console.error('Error creating Stripe customer:', error);
    throw error;
  }
}

/**
 * Get or create a customer in Stripe
 */
export async function getOrCreateStripeCustomer(userId: string, email: string, name?: string) {
  try {
    // First, try to find an existing customer
    const customers = await stripe.customers.list({
      email,
      limit: 1,
    });
    
    if (customers.data.length > 0) {
      // Update the customer with the latest information
      const customer = await stripe.customers.update(customers.data[0].id, {
        name,
        metadata: {
          userId,
        },
      });
      
      return customer;
    }
    
    // If no customer exists, create a new one
    return await createStripeCustomer(userId, email, name);
  } catch (error) {
    console.error('Error getting or creating Stripe customer:', error);
    throw error;
  }
}

/**
 * Create a subscription
 */
export async function createSubscription(
  customerId: string,
  priceId: string,
  paymentMethodId?: string
) {
  try {
    // If a payment method is provided, attach it to the customer
    if (paymentMethodId) {
      await stripe.paymentMethods.attach(paymentMethodId, {
        customer: customerId,
      });
      
      // Set as the default payment method
      await stripe.customers.update(customerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });
    }
    
    // Create the subscription
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      expand: ['latest_invoice.payment_intent'],
    });
    
    return subscription;
  } catch (error) {
    console.error('Error creating subscription:', error);
    throw error;
  }
}

/**
 * Cancel a subscription
 */
export async function cancelSubscription(subscriptionId: string, cancelAtPeriodEnd: boolean = true) {
  try {
    const subscription = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: cancelAtPeriodEnd,
    });
    
    return subscription;
  } catch (error) {
    console.error('Error canceling subscription:', error);
    throw error;
  }
}

/**
 * Update a subscription
 */
export async function updateSubscription(
  subscriptionId: string,
  priceId: string,
  prorationBehavior: Stripe.SubscriptionUpdateParams.ProrationBehavior = 'create_prorations'
) {
  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    
    // Update the subscription with the new price
    const updatedSubscription = await stripe.subscriptions.update(subscriptionId, {
      items: [
        {
          id: subscription.items.data[0].id,
          price: priceId,
        },
      ],
      proration_behavior: prorationBehavior,
    });
    
    return updatedSubscription;
  } catch (error) {
    console.error('Error updating subscription:', error);
    throw error;
  }
} 