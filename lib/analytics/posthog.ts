import posthog from 'posthog-js';
import { PostHog } from 'posthog-node';
import logger from '@/lib/logger';

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      POSTHOG_API_KEY: string;
      POSTHOG_HOST: string;
      NEXT_PUBLIC_POSTHOG_KEY: string;
      NEXT_PUBLIC_POSTHOG_HOST: string;
    }
  }
}

// Initialize PostHog for server-side tracking
const serverPostHog = new PostHog(
  process.env.POSTHOG_API_KEY || '',
  { host: process.env.POSTHOG_HOST || 'https://app.posthog.com' }
);

// Initialize client-side PostHog
if (typeof window !== 'undefined') {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY || '', {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com',
    capture_pageview: true,
    capture_pageleave: true,
  });
}

export const Analytics = {
  // User engagement events
  track: {
    signup: async (userId: string, source: string) => {
      try {
        await serverPostHog.capture({
          distinctId: userId,
          event: 'user_signed_up',
          properties: {
            source,
            timestamp: new Date().toISOString(),
          },
        });
      } catch (error) {
        logger.error('Failed to track signup event', error as Error);
      }
    },

    login: (userId: string) => {
      try {
        posthog.identify(userId);
        posthog.capture('user_logged_in');
      } catch (error) {
        logger.error('Failed to track login event', error as Error);
      }
    },

    subscriptionCreated: async (userId: string, planId: string, amount: number) => {
      try {
        await serverPostHog.capture({
          distinctId: userId,
          event: 'subscription_created',
          properties: {
            plan_id: planId,
            amount,
            currency: 'USD',
          },
        });
      } catch (error) {
        logger.error('Failed to track subscription event', error as Error);
      }
    },

    featureUsage: (userId: string, featureId: string) => {
      try {
        posthog.capture('feature_used', {
          feature_id: featureId,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        logger.error('Failed to track feature usage', error as Error);
      }
    },

    stripeEvent: async (userId: string, eventType: string) => {
      try {
        await serverPostHog.capture({
          distinctId: userId,
          event: `stripe_${eventType}`,
          properties: {
            timestamp: new Date().toISOString(),
          },
        });
      } catch (error) {
        logger.error('Failed to track Stripe event', error as Error);
      }
    },
  },

  // User properties
  identify: async (userId: string, properties: Record<string, any>) => {
    try {
      await serverPostHog.identify({
        distinctId: userId,
        properties: {
          ...properties,
          last_seen: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error('Failed to identify user', error as Error);
    }
  },

  // Cohort analysis
  setCohort: async (userId: string, cohortName: string) => {
    try {
      await serverPostHog.groupIdentify({
        groupType: 'cohort',
        groupKey: cohortName,
        distinctId: userId,
        properties: {
          joined_at: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error('Failed to set cohort', error as Error);
    }
  },
};

export default Analytics; 