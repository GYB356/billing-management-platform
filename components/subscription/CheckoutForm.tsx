'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { AlertCircle, CheckCircle, ArrowRight } from 'lucide-react';

interface PricingPlan {
  id: string;
  name: string;
  description: string;
  price: number; // in cents
  interval: 'month' | 'year';
  currency: string;
  features: string[];
  stripePriceId: string;
  trialDays?: number;
  mostPopular?: boolean;
}

interface CheckoutFormProps {
  organizationId: string;
  selectedPlan?: PricingPlan;
  plans: PricingPlan[];
  onSuccess?: (result: any) => void;
  onError?: (error: Error) => void;
}

export default function CheckoutForm({
  organizationId,
  selectedPlan,
  plans,
  onSuccess,
  onError,
}: CheckoutFormProps) {
  const router = useRouter();
  const stripe = useStripe();
  const elements = useElements();
  
  const [plan, setPlan] = useState<PricingPlan | undefined>(selectedPlan);
  const [couponCode, setCouponCode] = useState('');
  const [couponStatus, setCouponStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [couponMessage, setCouponMessage] = useState('');
  const [couponDiscount, setCouponDiscount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cardComplete, setCardComplete] = useState(false);
  const [processingTo, setProcessingTo] = useState<string | null>(null);
  
  // Format price for display
  const formatPrice = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
      minimumFractionDigits: 0,
    }).format(amount / 100);
  };
  
  // Calculate discounted price
  const calculateFinalPrice = (price: number) => {
    if (!couponDiscount) return price;
    return Math.max(0, price - couponDiscount);
  };
  
  // Apply coupon code
  const applyCoupon = async () => {
    if (!couponCode.trim()) return;
    
    setCouponStatus('loading');
    try {
      const response = await fetch(`/api/coupons/validate?code=${encodeURIComponent(couponCode)}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to validate coupon');
      }
      
      if (data.valid) {
        setCouponStatus('success');
        setCouponMessage(`Coupon applied: ${data.description}`);
        setCouponDiscount(data.discountAmount);
      } else {
        setCouponStatus('error');
        setCouponMessage(data.message || 'Invalid coupon code');
        setCouponDiscount(null);
      }
    } catch (err: any) {
      setCouponStatus('error');
      setCouponMessage(err.message || 'Failed to validate coupon');
      setCouponDiscount(null);
    }
  };
  
  // Handle form submission
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    if (!stripe || !elements || !plan) {
      return;
    }
    
    const cardElement = elements.getElement(CardElement);
    if (!cardElement) {
      setError('Card element not found');
      return;
    }
    
    setLoading(true);
    setError(null);
    setProcessingTo(plan.name);
    
    try {
      // Create payment method
      const { error: stripeError, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card: cardElement,
      });
      
      if (stripeError) {
        throw new Error(stripeError.message);
      }
      
      // Create subscription
      const response = await fetch('/api/subscriptions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          organizationId,
          planId: plan.id,
          priceId: plan.stripePriceId,
          paymentMethodId: paymentMethod.id,
          couponCode: couponStatus === 'success' ? couponCode : undefined,
        }),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to create subscription');
      }
      
      // Handle subscription result
      if (result.requiresAction) {
        // Handle 3D Secure authentication if required
        const { error: confirmError, paymentIntent } = await stripe.confirmCardPayment(
          result.clientSecret
        );
        
        if (confirmError) {
          throw new Error(confirmError.message);
        }
      }
      
      // Success
      if (onSuccess) {
        onSuccess(result);
      } else {
        // Redirect to subscription management page
        router.push('/dashboard/subscription');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
      if (onError) {
        onError(err);
      }
    } finally {
      setLoading(false);
      setProcessingTo(null);
    }
  };
  
  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Select a Plan</h2>
        <p className="mt-2 text-gray-600">Choose the plan that best fits your needs</p>
      </div>
      
      {/* Plan selection */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {plans.map((p) => (
          <div 
            key={p.id}
            className={`border rounded-lg p-6 cursor-pointer transition-all ${
              plan?.id === p.id 
                ? 'border-indigo-500 bg-indigo-50 shadow-md' 
                : 'border-gray-200 hover:border-indigo-300 hover:shadow-sm'
            } ${p.mostPopular ? 'relative' : ''}`}
            onClick={() => setPlan(p)}
          >
            {p.mostPopular && (
              <div className="absolute top-0 right-0 bg-indigo-500 text-white px-3 py-1 text-xs font-semibold rounded-bl-lg rounded-tr-lg">
                Most Popular
              </div>
            )}
            <h3 className="text-lg font-semibold text-gray-900">{p.name}</h3>
            <p className="text-gray-500 text-sm mt-1">{p.description}</p>
            <div className="mt-4">
              <span className="text-3xl font-bold text-gray-900">
                {formatPrice(p.price, p.currency)}
              </span>
              <span className="text-gray-500">/{p.interval}</span>
            </div>
            {p.trialDays && (
              <p className="mt-2 text-sm text-indigo-600">
                Includes {p.trialDays}-day free trial
              </p>
            )}
            <ul className="mt-4 space-y-2">
              {p.features.map((feature, index) => (
                <li key={index} className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" />
                  <span className="text-sm text-gray-700">{feature}</span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className={`mt-6 w-full py-2 px-4 rounded-md font-medium ${
                plan?.id === p.id
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                  : 'bg-white text-indigo-600 border border-indigo-600 hover:bg-indigo-50'
              }`}
              onClick={() => setPlan(p)}
            >
              {plan?.id === p.id ? 'Selected' : 'Select'}
            </button>
          </div>
        ))}
      </div>
      
      {plan && (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">Complete your subscription</h3>
          
          {/* Plan summary */}
          <div className="mb-6 p-4 bg-gray-50 rounded-md">
            <div className="flex justify-between items-center">
              <div>
                <p className="font-medium text-gray-900">{plan.name}</p>
                <p className="text-sm text-gray-500">
                  {formatPrice(plan.price, plan.currency)}/{plan.interval}
                </p>
              </div>
              <button
                type="button"
                className="text-sm text-indigo-600 hover:text-indigo-800"
                onClick={() => setPlan(undefined)}
              >
                Change
              </button>
            </div>
            
            {/* Coupon/discount */}
            {couponStatus === 'success' && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <div className="flex justify-between items-center">
                  <div className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    <p className="text-sm text-green-600">{couponMessage}</p>
                  </div>
                  <p className="text-sm font-medium text-gray-900">
                    -{formatPrice(couponDiscount || 0, plan.currency)}
                  </p>
                </div>
              </div>
            )}
            
            {/* Total */}
            <div className="mt-3 pt-3 border-t border-gray-200">
              <div className="flex justify-between items-center">
                <p className="font-medium text-gray-900">Total</p>
                <p className="font-bold text-gray-900">
                  {formatPrice(calculateFinalPrice(plan.price), plan.currency)}/{plan.interval}
                </p>
              </div>
            </div>
          </div>
          
          {/* Coupon input */}
          <div className="mb-6">
            <label htmlFor="coupon" className="block text-sm font-medium text-gray-700 mb-1">
              Have a coupon?
            </label>
            <div className="flex">
              <input
                type="text"
                id="coupon"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value)}
                placeholder="Enter coupon code"
                className="flex-grow px-3 py-2 border border-gray-300 rounded-l-md focus:ring-indigo-500 focus:border-indigo-500"
                disabled={loading || couponStatus === 'success'}
              />
              <button
                type="button"
                onClick={applyCoupon}
                className="bg-gray-100 border border-gray-300 border-l-0 px-4 py-2 rounded-r-md hover:bg-gray-200 font-medium text-gray-700"
                disabled={loading || !couponCode || couponStatus === 'success'}
              >
                Apply
              </button>
            </div>
            {couponStatus === 'error' && (
              <p className="mt-1 text-sm text-red-600 flex items-center">
                <AlertCircle className="h-4 w-4 mr-1" />
                {couponMessage}
              </p>
            )}
          </div>
          
          {/* Payment details */}
          <div className="mb-6">
            <label htmlFor="card-element" className="block text-sm font-medium text-gray-700 mb-1">
              Card details
            </label>
            <div className="border border-gray-300 rounded-md p-3 focus-within:ring-1 focus-within:ring-indigo-500 focus-within:border-indigo-500">
              <CardElement
                id="card-element"
                options={{
                  style: {
                    base: {
                      fontSize: '16px',
                      color: '#424770',
                      '::placeholder': {
                        color: '#aab7c4',
                      },
                    },
                    invalid: {
                      color: '#9e2146',
                    },
                  },
                }}
                onChange={(e) => setCardComplete(e.complete)}
              />
            </div>
          </div>
          
          {/* Error message */}
          {error && (
            <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600 flex items-center">
                <AlertCircle className="h-4 w-4 mr-1" />
                {error}
              </p>
            </div>
          )}
          
          {/* Terms & conditions */}
          <div className="mb-6">
            <p className="text-sm text-gray-500">
              By confirming your subscription, you allow us to charge your card for this payment and future payments in accordance with our terms. You can cancel anytime.
            </p>
          </div>
          
          {/* Submit button */}
          <button
            type="submit"
            disabled={!stripe || !elements || !cardComplete || loading}
            className={`w-full flex items-center justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-indigo-600 ${
              !stripe || !elements || !cardComplete || loading
                ? 'opacity-50 cursor-not-allowed'
                : 'hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
            }`}
          >
            {loading ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {processingTo ? `Subscribing to ${processingTo}...` : 'Processing...'}
              </>
            ) : (
              <>
                Subscribe Now <ArrowRight className="ml-2 h-5 w-5" />
              </>
            )}
          </button>
        </form>
      )}
    </div>
  );
} 