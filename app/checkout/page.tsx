'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import CouponRedemption from '@/components/CouponRedemption';
import TrialSignup from '@/components/TrialSignup';
import OneTimePaymentForm from '@/components/OneTimePaymentForm';
import PayPalCheckout from '@/components/checkout/PayPalCheckout';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

// Sample plan data (you would typically fetch this from your backend)
const PLANS = [
  {
    id: 'basic',
    name: 'Basic Plan',
    price: 9.99,
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
    price: 29.99,
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

type CheckoutOption = 'trial' | 'card' | 'paypal' | null;

export default function CheckoutPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [selectedPlan, setSelectedPlan] = useState(PLANS[0]);
  const [checkoutOption, setCheckoutOption] = useState<CheckoutOption>(null);
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  
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
  
  const handlePaymentSuccess = async (data: any) => {
    try {
      setLoading(true);
      // Here you would typically:
      // 1. Call your backend to verify the payment
      // 2. Create/update subscription
      // 3. Generate invoice
      // 4. Send confirmation email
      
      toast.success('Payment successful!');
      router.push('/dashboard');
    } catch (error) {
      console.error('Error processing payment:', error);
      toast.error('Failed to process payment');
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentError = (error: any) => {
    console.error('Payment error:', error);
    toast.error('Payment failed. Please try again.');
  };
  
  return (
    <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
      <Card>
        <CardHeader>
          <h1 className="text-2xl font-bold text-gray-900">Checkout</h1>
        </CardHeader>
        <CardContent>
          {!checkoutOption ? (
            <div>
              <div className="mb-8">
                <h2 className="text-lg font-medium text-gray-900 mb-4">
                  Select a plan
                </h2>
                <div className="space-y-4">
                  {PLANS.map((plan) => (
                    <div
                      key={plan.id}
                      className={`border rounded-lg p-4 cursor-pointer ${
                        selectedPlan.id === plan.id ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200'
                      }`}
                      onClick={() => handleSelectPlan(plan)}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <h3 className="text-lg font-medium">{plan.name}</h3>
                          <p className="text-gray-500">${plan.price}/month</p>
                        </div>
                        <input
                          type="radio"
                          checked={selectedPlan.id === plan.id}
                          onChange={() => handleSelectPlan(plan)}
                          className="h-4 w-4 text-indigo-600"
                        />
                      </div>
                      <ul className="mt-2 space-y-1">
                        {plan.features.map((feature, index) => (
                          <li key={index} className="text-sm text-gray-600 flex items-center">
                            <span className="text-green-500 mr-2">✓</span>
                            {feature}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <h2 className="text-lg font-medium text-gray-900 mb-4">
                  Choose payment method
                </h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <Button
                    onClick={() => handleSelectCheckoutOption('trial')}
                    variant="outline"
                    className="h-auto py-4"
                  >
                    <div className="text-left">
                      <div className="font-medium">Start Free Trial</div>
                      <div className="text-sm text-gray-500">
                        {selectedPlan.trialDays} days free trial
                      </div>
                    </div>
                  </Button>
                  
                  <Button
                    onClick={() => handleSelectCheckoutOption('card')}
                    variant="outline"
                    className="h-auto py-4"
                  >
                    <div className="text-left">
                      <div className="font-medium">Credit Card</div>
                      <div className="text-sm text-gray-500">
                        Secure card payment
                      </div>
                    </div>
                  </Button>
                  
                  <Button
                    onClick={() => handleSelectCheckoutOption('paypal')}
                    variant="outline"
                    className="h-auto py-4"
                  >
                    <div className="text-left">
                      <div className="font-medium">PayPal</div>
                      <div className="text-sm text-gray-500">
                        Pay with PayPal
                      </div>
                    </div>
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <Button
                onClick={() => setCheckoutOption(null)}
                variant="ghost"
                className="mb-6"
              >
                ← Back to payment methods
              </Button>

              {checkoutOption === 'trial' && (
                <TrialSignup
                  plan={selectedPlan}
                  onSuccess={handlePaymentSuccess}
                />
              )}

              {checkoutOption === 'card' && (
                <OneTimePaymentForm
                  amount={selectedPlan.price}
                  onSuccess={handlePaymentSuccess}
                  onError={handlePaymentError}
                />
              )}

              {checkoutOption === 'paypal' && (
                <PayPalCheckout
                  amount={selectedPlan.price}
                  onSuccess={handlePaymentSuccess}
                  onError={handlePaymentError}
                />
              )}
            </div>
          )}

          <div className="mt-6">
            <CouponRedemption
              onApplyCoupon={handleApplyCoupon}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}