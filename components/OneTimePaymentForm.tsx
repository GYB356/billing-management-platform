'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  PaymentElement,
  useStripe,
  useElements,
  Elements,
} from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import CouponRedemption from './CouponRedemption';

// Make sure to call loadStripe outside of a component's render to avoid
// recreating the Stripe object on every render.
// This is your test publishable API key.
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');

type PaymentFormProps = {
  amount: number;
  currency: string;
  description: string;
  organizationId: string;
  onSuccess?: (paymentData: any) => void;
  onCancel?: () => void;
  metadata?: Record<string, any>;
  className?: string;
};

// This is the parent component that wraps the form in Stripe Elements
export default function OneTimePaymentForm(props: PaymentFormProps) {
  const [clientSecret, setClientSecret] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const { data: session } = useSession();
  
  useEffect(() => {
    // Create payment intent as soon as the page loads
    const createIntent = async () => {
      try {
        if (!session) {
          setError('You must be signed in to make a payment');
          setLoading(false);
          return;
        }
        
        // Calculate the actual payment amount with coupon applied
        let paymentAmount = props.amount;
        if (appliedCoupon && appliedCoupon.valid) {
          if (appliedCoupon.discount.type === 'percentage') {
            paymentAmount = Math.round(paymentAmount * (1 - appliedCoupon.discount.value / 100));
          } else {
            paymentAmount = Math.max(0, paymentAmount - appliedCoupon.discount.value);
          }
        }
        
        const response = await fetch('/api/payments', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            organizationId: props.organizationId,
            amount: paymentAmount,
            currency: props.currency,
            description: props.description,
            metadata: {
              ...props.metadata,
              ...(appliedCoupon && appliedCoupon.valid ? { couponCode: appliedCoupon.code } : {}),
            },
          }),
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.message || data.error || 'Failed to initialize payment');
        }
        
        setClientSecret(data.clientSecret);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred while setting up payment');
      } finally {
        setLoading(false);
      }
    };

    if (!clientSecret || appliedCoupon) {
      createIntent();
    }
  }, [props, session, appliedCoupon]);
  
  const handleApplyCoupon = (couponData: any) => {
    setAppliedCoupon(couponData);
  };
  
  const appearance = {
    theme: 'stripe' as const,
  };
  
  const options = {
    clientSecret,
    appearance,
  };
  
  if (loading) {
    return (
      <div className={`bg-white rounded-lg shadow-md p-6 ${props.className}`}>
        <div className="text-center py-4">
          <div className="animate-pulse flex space-x-4 justify-center items-center">
            <div className="rounded-full bg-slate-200 h-10 w-10"></div>
            <div className="flex-1 space-y-6 py-1 max-w-sm">
              <div className="h-2 bg-slate-200 rounded"></div>
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-4">
                  <div className="h-2 bg-slate-200 rounded col-span-2"></div>
                  <div className="h-2 bg-slate-200 rounded col-span-1"></div>
                </div>
                <div className="h-2 bg-slate-200 rounded"></div>
              </div>
            </div>
          </div>
          <p className="mt-4 text-gray-500">Setting up payment...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className={`bg-white rounded-lg shadow-md p-6 ${props.className}`}>
        <div className="text-center py-4">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
            <svg
              className="h-6 w-6 text-red-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h3 className="mt-3 text-lg font-medium text-gray-900">Payment setup failed</h3>
          <p className="mt-2 text-sm text-red-600">{error}</p>
          <div className="mt-4">
            <button
              type="button"
              onClick={props.onCancel}
              className="inline-flex justify-center rounded-md border border-gray-300 bg-white py-2 px-4 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              Go back
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  // Calculate the actual payment amount with coupon applied
  let displayAmount = props.amount;
  if (appliedCoupon && appliedCoupon.valid) {
    if (appliedCoupon.discount.type === 'percentage') {
      displayAmount = Math.round(displayAmount * (1 - appliedCoupon.discount.value / 100));
    } else {
      displayAmount = Math.max(0, displayAmount - appliedCoupon.discount.value);
    }
  }
  
  // Format currency
  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100); // Stripe uses cents
  };
  
  return (
    <div className={`bg-white rounded-lg shadow-md p-6 ${props.className}`}>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-1">
          {props.description}
        </h2>
        <p className="text-gray-600">
          Total: {formatCurrency(displayAmount, props.currency)}
        </p>
      </div>
      
      <CouponRedemption 
        onApplyCoupon={handleApplyCoupon}
        className="mb-6"
      />
      
      {clientSecret && (
        <Elements options={options} stripe={stripePromise}>
          <CheckoutForm 
            amount={displayAmount}
            currency={props.currency}
            onSuccess={props.onSuccess}
            onCancel={props.onCancel}
          />
        </Elements>
      )}
    </div>
  );
}

// Inner form component that's wrapped by Elements
function CheckoutForm({
  amount,
  currency,
  onSuccess,
  onCancel,
}: {
  amount: number;
  currency: string;
  onSuccess?: (paymentData: any) => void;
  onCancel?: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!stripe || !elements) {
      // Stripe.js hasn't yet loaded.
      // Make sure to disable form submission until Stripe.js has loaded.
      return;
    }
    
    setIsLoading(true);
    
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/payment/confirmation`,
      },
      redirect: 'if_required',
    });
    
    // If the payment didn't need additional actions and completed immediately
    if (paymentIntent && paymentIntent.status === 'succeeded') {
      setPaymentSuccess(true);
      setMessage('Payment successful!');
      
      if (onSuccess) {
        onSuccess(paymentIntent);
      }
      
      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);
    }
    
    if (error) {
      if (error.type === 'card_error' || error.type === 'validation_error') {
        setMessage(error.message || 'An error occurred with your payment');
      } else {
        setMessage('An unexpected error occurred');
      }
    }
    
    setIsLoading(false);
  };
  
  return (
    <>
      {paymentSuccess ? (
        <div className="text-center py-4">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
            <svg
              className="h-6 w-6 text-green-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h3 className="mt-3 text-lg font-medium text-gray-900">Payment successful!</h3>
          <p className="mt-2 text-sm text-gray-500">
            Thank you for your payment. You will be redirected to the dashboard shortly.
          </p>
        </div>
      ) : (
        <form id="payment-form" onSubmit={handleSubmit}>
          <PaymentElement id="payment-element" />
          <button
            disabled={isLoading || !stripe || !elements}
            id="submit"
            className="mt-6 w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            <span id="button-text">
              {isLoading ? (
                <div className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </div>
              ) : (
                `Pay ${new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(amount / 100)}`
              )}
            </span>
          </button>
          
          {message && (
            <div 
              className={`mt-4 text-sm ${paymentSuccess ? 'text-green-600' : 'text-red-600'}`}
            >
              {message}
            </div>
          )}
          
          {onCancel && (
            <button
              type="button"
              className="mt-3 w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              onClick={onCancel}
              disabled={isLoading}
            >
              Cancel
            </button>
          )}
        </form>
      )}
    </>
  );
} 