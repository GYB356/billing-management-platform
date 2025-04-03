import { useState } from 'react';
import { useSubscription } from '@/contexts/subscription-context';
import { SubscriptionWithPlan } from '@/lib/subscription';

interface UseSubscriptionActions {
  updatePlan: (planId: string) => Promise<void>;
  cancelSubscription: () => Promise<void>;
  resumeSubscription: () => Promise<void>;
  recordUsage: (featureId: string, quantity: number) => Promise<void>;
}

export function useSubscriptionActions(): UseSubscriptionActions {
  const { subscription, refreshSubscription } = useSubscription();
  const [loading, setLoading] = useState(false);

  const updatePlan = async (planId: string) => {
    if (!subscription) return;

    try {
      setLoading(true);
      const response = await fetch('/api/subscription/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
      });

      if (!response.ok) {
        throw new Error('Failed to update subscription');
      }

      await refreshSubscription();
    } catch (error) {
      console.error('Error updating subscription:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const cancelSubscription = async () => {
    if (!subscription) return;

    try {
      setLoading(true);
      const response = await fetch('/api/subscription/cancel', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to cancel subscription');
      }

      await refreshSubscription();
    } catch (error) {
      console.error('Error canceling subscription:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const resumeSubscription = async () => {
    if (!subscription) return;

    try {
      setLoading(true);
      const response = await fetch('/api/subscription/resume', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to resume subscription');
      }

      await refreshSubscription();
    } catch (error) {
      console.error('Error resuming subscription:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const recordUsage = async (featureId: string, quantity: number) => {
    if (!subscription) return;

    try {
      setLoading(true);
      const response = await fetch('/api/subscription/usage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ featureId, quantity }),
      });

      if (!response.ok) {
        throw new Error('Failed to record usage');
      }
    } catch (error) {
      console.error('Error recording usage:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return {
    updatePlan,
    cancelSubscription,
    resumeSubscription,
    recordUsage,
  };
} 