import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set');
}

// Initialize Stripe with the secret key from environment variables
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
  typescript: true,
});

// Helper function to format amounts for display (from cents to dollars)
export function formatAmount(amount: number, currency: string = 'usd'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(amount / 100);
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