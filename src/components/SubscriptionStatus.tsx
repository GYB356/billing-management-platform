'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { format } from 'date-fns';
import { SUBSCRIPTION_PLANS } from '@/lib/stripe';

interface Subscription {
  status: string;
  plan_name: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
}

export function SubscriptionStatus() {
  const { data: session } = useSession();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSubscription = async () => {
      try {
        const response = await fetch('/api/subscription');
        const data = await response.json();
        if (response.ok) {
          setSubscription(data.subscription);
        } else {
          setError(data.error || 'Failed to fetch subscription');
        }
      } catch (err) {
        setError('An error occurred while fetching subscription');
      } finally {
        setLoading(false);
      }
    };

    if (session) {
      fetchSubscription();
    }
  }, [session]);

  const handleCancelSubscription = async () => {
    try {
      const response = await fetch('/api/subscription/cancel', {
        method: 'POST',
      });
      const data = await response.json();
      
      if (response.ok) {
        setSubscription(data.subscription);
      } else {
        setError(data.error || 'Failed to cancel subscription');
      }
    } catch (err) {
      setError('An error occurred while canceling subscription');
    }
  };

  const handleRenewSubscription = async () => {
    try {
      const response = await fetch('/api/subscription/renew', {
        method: 'POST',
      });
      const data = await response.json();
      
      if (response.ok) {
        setSubscription(data.subscription);
      } else {
        setError(data.error || 'Failed to renew subscription');
      }
    } catch (err) {
      setError('An error occurred while renewing subscription');
    }
  };

  if (loading) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="space-y-3 mt-4">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <h3 className="text-lg font-medium text-gray-900">Subscription Status</h3>
      
      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {subscription ? (
        <div className="mt-4 space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-gray-500">Current Plan</p>
              <p className="text-lg font-medium text-gray-900">
                {subscription.plan_name}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Status</p>
              <p className={`text-lg font-medium ${
                subscription.status === 'active' ? 'text-green-600' : 'text-red-600'
              }`}>
                {subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1)}
              </p>
            </div>
          </div>

          <div>
            <p className="text-sm text-gray-500">Renewal Date</p>
            <p className="text-lg font-medium text-gray-900">
              {format(new Date(subscription.current_period_end), 'MMMM d, yyyy')}
            </p>
          </div>

          <div className="flex space-x-4">
            {subscription.status === 'active' && !subscription.cancel_at_period_end && (
              <button
                onClick={handleCancelSubscription}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel Subscription
              </button>
            )}
            {subscription.status === 'canceled' && (
              <button
                onClick={handleRenewSubscription}
                className="px-4 py-2 bg-indigo-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-indigo-700"
              >
                Renew Subscription
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-4">
          <p className="text-gray-500">No active subscription</p>
          <a
            href="/pricing"
            className="mt-4 inline-block px-4 py-2 bg-indigo-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-indigo-700"
          >
            View Plans
          </a>
        </div>
      )}
    </div>
  );
} 