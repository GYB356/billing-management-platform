import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/ui/icons';

interface PaymentMethod {
  id: string;
  type: string;
  last4: string;
  expiryMonth: number;
  expiryYear: number;
  isDefault: boolean;
  brand: string;
}

export function PaymentMethods() {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPaymentMethods = async () => {
      try {
        const response = await fetch('/api/payment-methods');
        if (!response.ok) throw new Error('Failed to fetch payment methods');
        const data = await response.json();
        setPaymentMethods(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchPaymentMethods();
  }, []);

  const handleAddPaymentMethod = async () => {
    // Implement Stripe Elements or similar for adding new payment methods
  };

  const handleSetDefault = async (id: string) => {
    try {
      const response = await fetch('/api/payment-methods/default', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ paymentMethodId: id }),
      });

      if (!response.ok) throw new Error('Failed to set default payment method');

      // Refresh payment methods
      const data = await response.json();
      setPaymentMethods(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set default payment method');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to remove this payment method?')) return;

    try {
      const response = await fetch(`/api/payment-methods/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete payment method');

      setPaymentMethods(paymentMethods.filter(pm => pm.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete payment method');
    }
  };

  if (loading) return <div>Loading payment methods...</div>;
  if (error) return <div className="text-red-500">Error: {error}</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold text-gray-900">Payment Methods</h3>
        <Button onClick={handleAddPaymentMethod}>
          <Icons.plus className="mr-2 h-4 w-4" />
          Add Payment Method
        </Button>
      </div>

      {paymentMethods.length === 0 ? (
        <Card className="p-6">
          <p className="text-gray-500 text-center">No payment methods found.</p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {paymentMethods.map((method) => (
            <Card key={method.id} className="p-6">
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-8 flex items-center">
                    {method.brand === 'visa' && <Icons.visa className="w-12 h-8" />}
                    {method.brand === 'mastercard' && <Icons.mastercard className="w-12 h-8" />}
                    {method.brand === 'amex' && <Icons.amex className="w-12 h-8" />}
                  </div>
                  <div>
                    <p className="font-medium">
                      •••• {method.last4}
                    </p>
                    <p className="text-sm text-gray-500">
                      Expires {method.expiryMonth}/{method.expiryYear}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  {!method.isDefault && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSetDefault(method.id)}
                    >
                      Make Default
                    </Button>
                  )}
                  {method.isDefault && (
                    <span className="text-sm text-green-600 font-medium">
                      Default
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(method.id)}
                  >
                    <Icons.trash className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
} 