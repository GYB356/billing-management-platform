'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, XCircle, ArrowUpRight, ArrowDownRight, Info } from 'lucide-react';

interface Plan {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  interval: string;
  features: string[];
  isPopular?: boolean;
}

interface Subscription {
  id: string;
  status: string;
  currentPlan: {
    id: string;
    name: string;
    price: number;
    currency: string;
  };
  quantity: number;
}

interface PlanChangeFormProps {
  subscription: Subscription;
  availablePlans: Plan[];
}

export default function PlanChangeForm({ subscription, availablePlans }: PlanChangeFormProps) {
  const router = useRouter();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [quantity, setQuantity] = useState<number>(subscription.quantity || 1);
  const [isProrate, setIsProrate] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [confirmChange, setConfirmChange] = useState<boolean>(false);
  const [proratedAmount, setProratedAmount] = useState<number | null>(null);
  const [proratedCurrency, setProratedCurrency] = useState<string | null>(null);

  // Format price for display
  const formatPrice = (price: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(price / 100);
  };

  // Check if plan is upgrade, downgrade, or same tier
  const getPlanChangeType = (planId: string) => {
    const currentPlanPrice = subscription.currentPlan.price;
    const selectedPlanPrice = availablePlans.find(p => p.id === planId)?.price || 0;

    if (selectedPlanPrice > currentPlanPrice) return 'upgrade';
    if (selectedPlanPrice < currentPlanPrice) return 'downgrade';
    return 'same';
  };

  // Get proration information when plan is selected
  useEffect(() => {
    const getProration = async () => {
      if (!selectedPlan || selectedPlan === subscription.currentPlan.id) {
        setProratedAmount(null);
        return;
      }
      
      try {
        setLoading(true);
        const response = await fetch('/api/subscriptions/proration-preview', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            subscriptionId: subscription.id,
            newPlanId: selectedPlan,
            quantity: quantity,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to get proration information');
        }

        setProratedAmount(data.proratedAmount);
        setProratedCurrency(data.currency);
      } catch (err: any) {
        console.error('Error getting proration information:', err);
        // Don't show error to user, just reset proration info
        setProratedAmount(null);
      } finally {
        setLoading(false);
      }
    };

    getProration();
  }, [selectedPlan, quantity, subscription.id, subscription.currentPlan.id]);

  const handlePlanChange = async () => {
    if (!selectedPlan) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/subscriptions/${subscription.id}/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planId: selectedPlan,
          quantity: quantity,
          prorate: isProrate,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update subscription');
      }

      setSuccess('Your subscription has been updated successfully!');
      
      // Redirect to subscription management page after short delay
      setTimeout(() => {
        router.push('/dashboard/subscription');
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'An error occurred while updating your subscription.');
    } finally {
      setLoading(false);
    }
  };

  const isCurrentPlan = (planId: string) => {
    return subscription.currentPlan.id === planId;
  };

  return (
    <div className="bg-white shadow rounded-lg overflow-hidden">
      <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
        <h3 className="text-lg leading-6 font-medium text-gray-900">
          Change Subscription Plan
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          Select a new plan to update your subscription
        </p>
      </div>

      <div className="px-4 py-5 sm:p-6">
        {/* Success/Error messages */}
        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
            <p className="text-sm text-green-600 flex items-center">
              <CheckCircle className="h-4 w-4 mr-1" />
              {success}
            </p>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600 flex items-center">
              <XCircle className="h-4 w-4 mr-1" />
              {error}
            </p>
          </div>
        )}

        {/* Current plan info */}
        <div className="mb-6 p-4 bg-gray-50 rounded-md">
          <h4 className="text-sm font-medium text-gray-700">Current Plan</h4>
          <p className="mt-1 text-lg font-semibold text-gray-900">
            {subscription.currentPlan.name}
          </p>
          <p className="text-sm text-gray-600">
            {formatPrice(subscription.currentPlan.price, subscription.currentPlan.currency)}
            {subscription.currentPlan.currency.toLowerCase() !== 'usd' && ' per month'}
          </p>
          {subscription.quantity > 1 && (
            <p className="text-sm text-gray-600">
              Quantity: {subscription.quantity}
            </p>
          )}
        </div>

        {/* Plan selection */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-gray-700">Available Plans</h4>
          
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {availablePlans.map((plan) => {
              const changeType = getPlanChangeType(plan.id);
              const isCurrent = isCurrentPlan(plan.id);
              
              return (
                <div 
                  key={plan.id}
                  className={`border rounded-lg p-4 cursor-pointer transition-shadow hover:shadow-md ${
                    selectedPlan === plan.id 
                      ? 'border-indigo-500 ring-2 ring-indigo-200' 
                      : 'border-gray-200'
                  } ${
                    isCurrent ? 'bg-gray-50' : ''
                  } ${
                    plan.isPopular ? 'relative' : ''
                  }`}
                  onClick={() => setSelectedPlan(plan.id)}
                >
                  {plan.isPopular && (
                    <span className="absolute top-0 right-0 bg-indigo-500 text-white px-2 py-1 text-xs font-medium rounded-bl-lg rounded-tr-lg">
                      Popular
                    </span>
                  )}
                  
                  {isCurrent && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 mb-2">
                      Current Plan
                    </span>
                  )}
                  
                  <h5 className="text-md font-medium text-gray-900">{plan.name}</h5>
                  <p className="text-gray-500 text-sm mb-2">{plan.description}</p>
                  
                  <p className="text-lg font-semibold text-gray-900">
                    {formatPrice(plan.price, plan.currency)}
                    <span className="text-sm text-gray-500 font-normal">
                      /{plan.interval}
                    </span>
                  </p>
                  
                  {!isCurrent && changeType === 'upgrade' && (
                    <p className="text-xs text-green-600 flex items-center mt-1">
                      <ArrowUpRight className="h-3 w-3 mr-1" />
                      Upgrade
                    </p>
                  )}
                  
                  {!isCurrent && changeType === 'downgrade' && (
                    <p className="text-xs text-amber-600 flex items-center mt-1">
                      <ArrowDownRight className="h-3 w-3 mr-1" />
                      Downgrade
                    </p>
                  )}
                  
                  <ul className="mt-3 space-y-1">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="text-sm text-gray-600 flex items-start">
                        <CheckCircle className="h-4 w-4 text-green-500 mr-1 flex-shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>

        {/* Quantity selector for current selection */}
        {selectedPlan && !isCurrentPlan(selectedPlan) && (
          <div className="mt-6">
            <label htmlFor="quantity" className="block text-sm font-medium text-gray-700">
              Quantity
            </label>
            <div className="mt-1">
              <input
                type="number"
                id="quantity"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:w-1/4 sm:text-sm border-gray-300 rounded-md"
              />
            </div>
          </div>
        )}

        {/* Proration option */}
        {selectedPlan && !isCurrentPlan(selectedPlan) && (
          <div className="mt-4">
            <div className="flex items-start">
              <div className="flex items-center h-5">
                <input
                  id="prorate"
                  type="checkbox"
                  checked={isProrate}
                  onChange={() => setIsProrate(!isProrate)}
                  className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300 rounded"
                />
              </div>
              <div className="ml-3">
                <label htmlFor="prorate" className="text-sm font-medium text-gray-700">
                  Prorate charges
                </label>
                <p className="text-xs text-gray-500">
                  If checked, you'll be charged or credited for the remaining days in your current billing period.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Proration preview */}
        {selectedPlan && !isCurrentPlan(selectedPlan) && isProrate && proratedAmount !== null && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <div className="flex">
              <Info className="h-5 w-5 text-blue-400 mr-2" />
              <div>
                <p className="text-sm text-blue-700">
                  {proratedAmount > 0 ? (
                    <>
                      You'll be charged an additional {formatPrice(proratedAmount, proratedCurrency || 'usd')} for the upgrade.
                    </>
                  ) : proratedAmount < 0 ? (
                    <>
                      You'll receive a credit of {formatPrice(Math.abs(proratedAmount), proratedCurrency || 'usd')} for the downgrade.
                    </>
                  ) : (
                    <>
                      There will be no additional charges for this change.
                    </>
                  )}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="mt-6 flex flex-wrap gap-3">
          {selectedPlan && !isCurrentPlan(selectedPlan) && !confirmChange ? (
            <button
              type="button"
              onClick={() => setConfirmChange(true)}
              disabled={loading}
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Continue
            </button>
          ) : selectedPlan && !isCurrentPlan(selectedPlan) && confirmChange ? (
            <>
              <button
                type="button"
                onClick={handlePlanChange}
                disabled={loading}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                {loading ? 'Processing...' : 'Confirm Plan Change'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmChange(false)}
                disabled={loading}
                className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Back
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={true}
              className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-400 bg-gray-100 cursor-not-allowed"
            >
              {isCurrentPlan(selectedPlan || '') ? 'Current Plan' : 'Select a Plan'}
            </button>
          )}
          
          <button
            type="button"
            onClick={() => router.push('/dashboard/subscription')}
            className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
} 