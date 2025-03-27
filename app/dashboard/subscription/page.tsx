'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';

interface Subscription {
  id: string;
  status: string;
  current_period_start: Date;
  current_period_end: Date;
  cancel_at_period_end: boolean;
  plan: {
    name: string;
  };
}

export default function SubscriptionPage() {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSubscription();
  }, []);

  const fetchSubscription = async () => {
    try {
      const response = await fetch('/api/stripe/subscription');
      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setSubscription(data.subscription);
    } catch (error) {
      console.error('Error fetching subscription:', error);
      setError('Failed to load subscription details');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubscriptionAction = async (action: 'cancel' | 'resume') => {
    try {
      const response = await fetch('/api/stripe/subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action }),
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setSubscription(data.subscription);
    } catch (error) {
      console.error('Error managing subscription:', error);
      setError('Failed to update subscription');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-600">{error}</div>
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <h2 className="text-2xl font-bold mb-4">No Active Subscription</h2>
        <a
          href="/pricing"
          className="text-indigo-600 hover:text-indigo-500"
        >
          View Plans
        </a>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      <div className="px-4 py-6 sm:px-0">
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-2xl font-bold mb-6">Subscription Details</h2>

          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-medium">Current Plan</h3>
              <p className="text-gray-600">{subscription.plan.name}</p>
            </div>

            <div>
              <h3 className="text-lg font-medium">Status</h3>
              <p className="text-gray-600 capitalize">{subscription.status}</p>
            </div>

            <div>
              <h3 className="text-lg font-medium">Billing Period</h3>
              <p className="text-gray-600">
                {new Date(subscription.current_period_start).toLocaleDateString()} -{' '}
                {new Date(subscription.current_period_end).toLocaleDateString()}
              </p>
            </div>

            <div>
              <h3 className="text-lg font-medium">Auto-renewal</h3>
              <p className="text-gray-600">
                {subscription.cancel_at_period_end ? 'Disabled' : 'Enabled'}
              </p>
            </div>

            <div className="pt-4">
              {subscription.cancel_at_period_end ? (
                <button
                  onClick={() => handleSubscriptionAction('resume')}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-500"
                >
                  Resume Subscription
                </button>
              ) : (
                <button
                  onClick={() => handleSubscriptionAction('cancel')}
                  className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-500"
                >
                  Cancel Subscription
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 