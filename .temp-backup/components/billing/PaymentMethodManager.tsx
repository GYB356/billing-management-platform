import React, { useState, useEffect } from 'react';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CreditCard, CheckCircle, Trash } from 'lucide-react';

// Simple toast notification fallback
const showToast = (title: string, description: string, variant?: 'destructive') => {
  console.log(`${title}: ${description}`);
  if (variant === 'destructive') {
    alert(`Error: ${description}`);
  } else {
    alert(`${description}`);
  }
};

// Initialize Stripe
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');

// Payment method interface
interface PaymentMethod {
  id: string;
  type: string;
  brand?: string;
  last4?: string;
  expMonth?: number;
  expYear?: number;
  isDefault: boolean;
  createdAt: Date;
}

// Component for displaying and managing payment methods
export function PaymentMethodManager() {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddMethod, setShowAddMethod] = useState(false);
  const [setupIntentSecret, setSetupIntentSecret] = useState<string | null>(null);

  // Fetch payment methods on component load
  useEffect(() => {
    fetchPaymentMethods();
  }, []);

  // Fetch payment methods from API
  const fetchPaymentMethods = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/payment-methods');
      if (!response.ok) {
        throw new Error('Failed to fetch payment methods');
      }

      const data = await response.json();
      setPaymentMethods(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      showToast('Error', 'Failed to load payment methods', 'destructive');
    } finally {
      setLoading(false);
    }
  };

  // Handle removal of payment method
  const handleRemovePaymentMethod = async (id: string) => {
    if (!confirm('Are you sure you want to remove this payment method?')) {
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`/api/payment-methods/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to remove payment method');
      }

      // Remove from state
      setPaymentMethods(paymentMethods.filter(method => method.id !== id));
      showToast('Success', 'Payment method removed successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      showToast('Error', 'Failed to remove payment method', 'destructive');
    } finally {
      setLoading(false);
    }
  };

  // Handle setting default payment method
  const handleSetDefaultPaymentMethod = async (id: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/payment-methods/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          setAsDefault: true,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to set default payment method');
      }

      // Update state
      const updatedMethod = await response.json();
      setPaymentMethods(paymentMethods.map(method => 
        method.id === id 
          ? { ...method, isDefault: true } 
          : { ...method, isDefault: false }
      ));
      showToast('Success', 'Default payment method updated');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      showToast('Error', 'Failed to update default payment method', 'destructive');
    } finally {
      setLoading(false);
    }
  };

  // Start adding a new payment method
  const startAddingPaymentMethod = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/payment-methods/setup', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to setup payment method');
      }

      const { clientSecret } = await response.json();
      setSetupIntentSecret(clientSecret);
      setShowAddMethod(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      showToast('Error', 'Failed to setup new payment method', 'destructive');
    } finally {
      setLoading(false);
    }
  };

  // Handle successful payment method addition
  const handlePaymentMethodAdded = () => {
    setShowAddMethod(false);
    setSetupIntentSecret(null);
    fetchPaymentMethods();
    showToast('Success', 'Payment method added successfully');
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Payment Methods</CardTitle>
          <CardDescription>
            Manage your payment methods for billing
          </CardDescription>
        </CardHeader>

        <CardContent>
          {loading && !showAddMethod ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="rounded-md bg-destructive/15 p-4 text-destructive">
              {error}
            </div>
          ) : paymentMethods.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              No payment methods found. Add one to continue.
            </div>
          ) : (
            <div className="space-y-4">
              {paymentMethods.map((method) => (
                <div key={method.id} className="flex items-center justify-between p-4 border rounded-md">
                  <div className="flex items-center gap-3">
                    <CreditCard className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <div className="font-medium">
                        {method.brand} •••• {method.last4}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Expires {method.expMonth}/{method.expYear}
                      </div>
                    </div>
                    {method.isDefault && (
                      <span className="ml-2 inline-flex items-center rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                        Default
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {!method.isDefault && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSetDefaultPaymentMethod(method.id)}
                        disabled={loading}
                      >
                        Set Default
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleRemovePaymentMethod(method.id)}
                      disabled={loading || (method.isDefault && paymentMethods.length > 1)}
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {showAddMethod && setupIntentSecret && (
            <div className="mt-6 p-4 border rounded-md">
              <h3 className="text-sm font-medium mb-4">Add New Payment Method</h3>
              <Elements 
                stripe={stripePromise} 
                options={{ clientSecret: setupIntentSecret }}
              >
                <AddPaymentMethodForm 
                  onSuccess={handlePaymentMethodAdded} 
                  onCancel={() => setShowAddMethod(false)} 
                  isFirstMethod={paymentMethods.length === 0}
                />
              </Elements>
            </div>
          )}
        </CardContent>

        <CardFooter>
          <Button
            onClick={startAddingPaymentMethod}
            disabled={loading || showAddMethod}
          >
            {loading && !showAddMethod ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <CreditCard className="h-4 w-4 mr-2" />
            )}
            Add Payment Method
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

// Form for adding a new payment method
function AddPaymentMethodForm({ 
  onSuccess, 
  onCancel,
  isFirstMethod
}: { 
  onSuccess: () => void; 
  onCancel: () => void;
  isFirstMethod: boolean;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Confirm the setup
      const result = await stripe.confirmSetup({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/billing`,
        },
        redirect: 'if_required',
      });

      if (result.error) {
        throw new Error(result.error.message || 'Something went wrong');
      }

      // If we get here, setup was successful. Attach the payment method to the customer.
      if (result.setupIntent?.payment_method) {
        const response = await fetch('/api/payment-methods/attach', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            paymentMethodId: result.setupIntent.payment_method,
            setAsDefault: isFirstMethod, // Set as default if it's the first one
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to attach payment method');
        }

        onSuccess();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement />
      
      {error && (
        <div className="mt-4 text-sm text-destructive">
          {error}
        </div>
      )}
      
      <div className="mt-4 flex justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={!stripe || loading}
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            'Save Payment Method'
          )}
        </Button>
      </div>
    </form>
  );
} 