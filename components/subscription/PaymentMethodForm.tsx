'use client';

import { useState } from 'react';
import { useStripe, useElements, CardElement } from '@stripe/react-stripe-js';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle, CreditCard } from 'lucide-react';

interface PaymentMethodFormProps {
  currentMethod?: {
    id: string;
    brand: string;
    last4: string;
    expiryMonth: number;
    expiryYear: number;
  };
  onSuccess: () => void;
}

const CARD_ELEMENT_OPTIONS = {
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
};

export default function PaymentMethodForm({ currentMethod, onSuccess }: PaymentMethodFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [showForm, setShowForm] = useState(!currentMethod);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      const { error: stripeError, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card: elements.getElement(CardElement)!,
      });

      if (stripeError) {
        throw new Error(stripeError.message);
      }

      // Send the payment method to your backend
      const response = await fetch('/api/customer/payment-method', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paymentMethodId: paymentMethod.id,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update payment method');
      }

      // Clear the form
      elements.getElement(CardElement)?.clear();
      setShowForm(false);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {currentMethod && !showForm && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <CreditCard className="h-6 w-6" />
                <div>
                  <p className="font-medium">
                    {currentMethod.brand.charAt(0).toUpperCase() + currentMethod.brand.slice(1)} ****{currentMethod.last4}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Expires {currentMethod.expiryMonth}/{currentMethod.expiryYear}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={() => setShowForm(true)}
              >
                Update
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="p-4 border rounded-lg">
            <CardElement options={CARD_ELEMENT_OPTIONS} />
          </div>

          <div className="flex justify-end space-x-2">
            {currentMethod && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowForm(false)}
                disabled={processing}
              >
                Cancel
              </Button>
            )}
            <Button type="submit" disabled={!stripe || processing}>
              {processing ? 'Processing...' : 'Save Payment Method'}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
