import React from 'react';

interface PlanFeature {
  name: string;
  included: boolean | string | number;
}

interface BillingPlan {
  id: string;
  name: string;
  price: number;
  interval: 'month' | 'year';
  description: string;
  features: PlanFeature[];
  highlighted?: boolean;
}

interface PlanComparisonProps {
  plans: BillingPlan[];
  currency?: string;
  onSelectPlan: (planId: string) => void;
}

export default function PlanComparison({
  plans,
  currency = 'USD',
  onSelectPlan
}: PlanComparisonProps) {
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0
    }).format(price);
  };

  const formatFeatureValue = (value: boolean | string | number) => {
    if (typeof value === 'boolean') {
      return value ? '✓' : '×';
    }
    return value;
  };

  return (
    <div className="w-full overflow-x-auto">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 p-4">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={`rounded-lg overflow-hidden ${
              plan.highlighted
                ? 'ring-2 ring-blue-500 shadow-lg transform scale-105'
                : 'border border-gray-200'
            }`}
          >
            {/* Plan Header */}
            <div className="p-6 bg-white">
              <h3 className="text-2xl font-bold text-gray-900">{plan.name}</h3>
              <div className="mt-4">
                <span className="text-4xl font-extrabold">
                  {formatPrice(plan.price)}
                </span>
                <span className="text-gray-500">/{plan.interval}</span>
              </div>
              <p className="mt-4 text-gray-500">{plan.description}</p>
            </div>

            {/* Features List */}
            <div className="px-6 pb-6">
              <ul className="mt-6 space-y-4">
                {plan.features.map((feature, index) => (
                  <li
                    key={index}
                    className="flex items-start"
                  >
                    <span className={`flex-shrink-0 h-6 w-6 text-center ${
                      typeof feature.included === 'boolean'
                        ? feature.included
                          ? 'text-green-500'
                          : 'text-red-500'
                        : 'text-blue-500'
                    }`}>
                      {formatFeatureValue(feature.included)}
                    </span>
                    <span className="ml-3 text-gray-500">{feature.name}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Action Button */}
            <div className="px-6 pb-8">
              <button
                onClick={() => onSelectPlan(plan.id)}
                className={`w-full px-4 py-2 text-sm font-medium rounded-md ${
                  plan.highlighted
                    ? 'bg-blue-500 text-white hover:bg-blue-600'
                    : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                } transition-colors duration-200`}
              >
                Select {plan.name}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
} 