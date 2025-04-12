import { useState } from 'react';
import { useStripe, useElements, PaymentElement } from '@stripe/stripe-js';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Alert } from '@/components/ui/alert';
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
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setLoading(true);
    setError(null);

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
      onSuccess?.();
    } catch (err: any) {
      setError(err.message);
      onError?.(err);
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
            />
          </div>

          <div>
            <Label htmlFor="currency">Currency</Label>
            <Select
              id="currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              required
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
    </Card>
  );
} 