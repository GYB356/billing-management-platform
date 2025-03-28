'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import CouponRedemption from '@/components/CouponRedemption';
import TrialSignup from '@/components/TrialSignup';
import OneTimePaymentForm from '@/components/OneTimePaymentForm';

// Sample plan data
const PLANS = [
  {
    id: 'basic',
    name: 'Basic Plan',
    trialDays: 14,
    features: [
      'Basic features',
      'Up to 5 projects',
      'Email support',
      'Basic analytics',
    ],
  },
  {
    id: 'pro',
    name: 'Pro Plan',
    trialDays: 14,
    features: [
      'All Basic features',
      'Unlimited projects',
      'Priority support',
      'Advanced analytics',
      'Custom integrations',
    ],
  },
];

type CheckoutOption = 'trial' | 'oneTime' | null;

export default function CheckoutPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [selectedPlan, setSelectedPlan] = useState(PLANS[0]);
  const [checkoutOption, setCheckoutOption] = useState<CheckoutOption>(null);
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  
  // For one-time payment demo
  const [paymentAmount, setPaymentAmount] = useState(5000); // $50.00
  
  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 text-center">
            <h2 className="text-lg font-medium text-gray-900 mb-4">
              Please sign in to continue
            </h2>
            <button
              type="button"
              onClick={() => router.push('/auth/signin')}
              className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Sign in
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  const handleApplyCoupon = (couponData: any) => {
    setAppliedCoupon(couponData);
  };
  
  const handleSelectPlan = (plan: any) => {
    setSelectedPlan(plan);
  };
  
  const handleSelectCheckoutOption = (option: CheckoutOption) => {
    setCheckoutOption(option);
  };
  
  const handlePaymentSuccess = (data: any) => {
    console.log('Payment successful:', data);
    // Redirect or update UI as needed
  };
  
  const handleTrialSuccess = (data: any) => {
    console.log('Trial started successfully:', data);
    // Redirect or update UI as needed
  };
  
  return (
    <div className="min-h-screen bg-gray-50 pt-16 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">
              Checkout
            </h1>
            <p className="mt-4 text-lg text-gray-500">
              Choose your plan and payment option
            </p>
          </div>
          
          {/* Plan selection */}
          {!checkoutOption && (
            <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-8">
              <div className="px-4 py-5 sm:px-6">
                <h2 className="text-lg leading-6 font-medium text-gray-900">
                  Select a plan
                </h2>
              </div>
              <div className="border-t border-gray-200">
                <ul className="divide-y divide-gray-200">
                  {PLANS.map((plan) => (
                    <li key={plan.id}>
                      <div className="px-4 py-4 sm:px-6">
                        <label className="flex items-center">
                          <input
                            type="radio"
                            name="plan"
                            value={plan.id}
                            checked={selectedPlan.id === plan.id}
                            onChange={() => handleSelectPlan(plan)}
                            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                          />
                          <span className="ml-3 text-sm font-medium text-gray-900">
                            {plan.name}
                          </span>
                        </label>
                        <div className="mt-2 ml-7">
                          <p className="text-sm text-gray-500">
                            {plan.features.join(' • ')}
                          </p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
              
              {/* Checkout options */}
              <div className="px-4 py-5 sm:px-6 bg-gray-50">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                  Choose an option
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => handleSelectCheckoutOption('trial')}
                    className="inline-flex justify-center items-center px-4 py-3 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    <span>Start {selectedPlan.trialDays}-day free trial</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectCheckoutOption('oneTime')}
                    className="inline-flex justify-center items-center px-4 py-3 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    <span>Make a one-time payment</span>
                  </button>
                </div>
              </div>
              
              {/* Coupon redemption example */}
              <div className="px-4 py-5 sm:px-6 border-t border-gray-200">
                <CouponRedemption
                  planId={selectedPlan.id}
                  onApplyCoupon={handleApplyCoupon}
                />
              </div>
            </div>
          )}
          
          {/* Trial signup */}
          {checkoutOption === 'trial' && (
            <div className="mb-8">
              <button
                type="button"
                onClick={() => handleSelectCheckoutOption(null)}
                className="mb-4 inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-500"
              >
                <svg
                  className="mr-1 h-5 w-5"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M9.707 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 1.414L7.414 9H15a1 1 0 110 2H7.414l2.293 2.293a1 1 0 010 1.414z"
                    clipRule="evenodd"
                  />
                </svg>
                Back
              </button>
              
              <TrialSignup
                plan={selectedPlan}
                onSuccess={handleTrialSuccess}
              />
            </div>
          )}
          
          {/* One-time payment */}
          {checkoutOption === 'oneTime' && (
            <div className="mb-8">
              <button
                type="button"
                onClick={() => handleSelectCheckoutOption(null)}
                className="mb-4 inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-500"
              >
                <svg
                  className="mr-1 h-5 w-5"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M9.707 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 1.414L7.414 9H15a1 1 0 110 2H7.414l2.293 2.293a1 1 0 010 1.414z"
                    clipRule="evenodd"
                  />
                </svg>
                Back
              </button>
              
              <OneTimePaymentForm
                amount={paymentAmount}
                currency="usd"
                description={`One-time payment for ${selectedPlan.name}`}
                organizationId="org_123" // You'll need to replace with actual org ID
                onSuccess={handlePaymentSuccess}
                onCancel={() => handleSelectCheckoutOption(null)}
                metadata={{
                  planId: selectedPlan.id,
                  paymentType: 'one-time'
                }}
              />
            </div>
          )}
          
        </div>
      </div>
    </div>
  );
} 