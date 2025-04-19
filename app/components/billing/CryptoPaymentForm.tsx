import { useState, useEffect } from 'react';
import { useStripe, useElements, PaymentElement } from '@stripe/stripe-js';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Alert } from '@/components/ui/alert';
import { retryOperation } from '@/lib/utils/retry';
import { defaultCryptoConfig } from '@/app/billing/features/crypto/config';

interface CryptoPaymentFormProps {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export function CryptoPaymentForm({ onSuccess, onError }: CryptoPaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('usdc');
  const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [formReset, setFormReset] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setLoading(true);
    setError(null);
      setSuccess(null);

    await retryOperation(
      async () => {
        try {
          // Create payment intent
          const response = await fetch('/api/payment/crypto', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              amount: Math.round(parseFloat(amount) * 100), // Convert to cents
              currency,
            }),
          });

          if (!response.ok) {
            throw new Error('Failed to create payment intent');
          }

          const { clientSecret } = await response.json();

          // Confirm the payment
          const { error: paymentError } = await stripe.confirmCryptoPayment(clientSecret, {
            payment_method: {
              crypto: elements.getElement('crypto')!,
            },
          });

          if (paymentError) {
            throw new Error(paymentError.message);
          }
          // Payment successful
          setSuccess('Payment successful!');
          setFormReset(true);
          onSuccess?.();
        } catch (err: any) {
          setError(err.message);
          onError?.(err);
          throw err;
        }
      },
      3,
      1000
    );
        
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6">
      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          <div>
            <Label htmlFor="amount">Amount</Label>
            <Input
              id="amount"
              type="number"
              min="0.50"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              placeholder="Enter amount"
                disabled={loading}
            />
          </div>

          <div>
            <Label htmlFor="currency">Currency</Label>
            <Select
              id="currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              required
              disabled={loading}
            >
              {defaultCryptoConfig.supportedCurrencies.map((curr) => (
                <option key={curr} value={curr}>
                  {curr.toUpperCase()}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label>Payment Method</Label>
              {formReset && (
                  <div className='mb-4'>
                    <Alert variant="success">
                        Payment processed successfully
                    </Alert>
                  </div>)}
            <PaymentElement />
          </div>

          {error && (
            <Alert variant="destructive">
              {error}
            </Alert>
          )}

          <Button
            type="submit"
            disabled={!stripe || !elements || loading}
            className="w-full"
          >
            {loading ? 'Processing...' : 'Pay with Crypto'}
          </Button>
        </div>
      </form>
        {success && (
            <Alert variant="success" className='mt-4'>
                {success}
            </Alert>
        )}
        {error && (
            <Alert variant="destructive" className='mt-4'>
                {error}
            </Alert>
        )}
          {useEffect(() => {
              const timer = setTimeout(() => setSuccess(null), 5000);
              return () => clearTimeout(timer);
          }, [success])}
    </Card>
  );
} 