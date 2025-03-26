'use client';

import React, { useState } from 'react';
import { useSession } from 'next-auth/react';
import { SUBSCRIPTION_PLANS } from '@/lib/stripe';

interface SubscriptionPlan {
  name: string;
  price: number;
  stripePriceId: string | undefined;
  features: string[];
}

export default function PricingPage() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubscribe = async (priceId: string) => {
    if (!session) {
      setError('Please sign in to subscribe');
      return;
    }

    try {
      setLoading(priceId);
      setError(null);

      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ priceId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session');
      }

      // Redirect to Stripe Checkout
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="bg-white">
      <div className="max-w-7xl mx-auto py-24 px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-base font-semibold text-indigo-600 tracking-wide uppercase">
            Pricing
          </h2>
          <p className="mt-2 text-3xl font-extrabold text-gray-900 sm:text-4xl">
            Choose the right plan for you
          </p>
        </div>

        <div className="mt-12 space-y-4 sm:mt-16 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-6 lg:max-w-4xl lg:mx-auto xl:max-w-none xl:mx-0 xl:grid-cols-3">
          {Object.entries(SUBSCRIPTION_PLANS).map(([key, plan]) => (
            <div
              key={key}
              className="border border-gray-200 rounded-lg shadow-sm divide-y divide-gray-200 hover:shadow-lg transition-shadow duration-200"
            >
              <div className="p-6">
                <h2 className="text-2xl font-semibold text-gray-900 sm:text-3xl">
                  {plan.name}
                </h2>
                <p className="mt-4 text-gray-500">
                  {plan.features.map((feature) => (
                    <span key={feature} className="block mb-2">
                      ✓ {feature}
                    </span>
                  ))}
                </p>
                <p className="mt-8">
                  <span className="text-4xl font-extrabold text-gray-900">
                    ${plan.price}
                  </span>
                  <span className="text-base font-medium text-gray-500">
                    /month
                  </span>
                </p>
                <button
                  onClick={() => handleSubscribe(plan.stripePriceId!)}
                  disabled={loading === plan.stripePriceId}
                  className="mt-8 block w-full bg-indigo-600 border border-transparent rounded-md py-2 text-sm font-semibold text-white text-center hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                >
                  {loading === plan.stripePriceId
                    ? 'Processing...'
                    : 'Subscribe now'}
                </button>
              </div>
            </div>
          ))}
        </div>

        {error && (
          <div className="mt-8 text-center">
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative">
              {error}
            </div>
          </div>
        )}

        {!session && (
          <div className="mt-8 text-center">
            <p className="text-gray-600">
              Please sign in to subscribe to a plan
            </p>
          </div>
        )}
      </div>
    </div>
  );
} 