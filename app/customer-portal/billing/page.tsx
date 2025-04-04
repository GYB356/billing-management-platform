'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useSession } from 'next-auth/react';
import { Loader2, CreditCard, Trash2 } from 'lucide-react';
import { formatCurrency } from '@/lib/currency';

interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
}

interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  currency: string;
  interval: string;
  features: string[];
}

export default function BillingPage() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [paymentMethodsRes, plansRes] = await Promise.all([
          fetch('/api/payment-methods'),
          fetch('/api/subscription/plans'),
        ]);

        if (!paymentMethodsRes.ok || !plansRes.ok) {
          throw new Error('Failed to fetch data');
        }

        const [paymentMethodsData, plansData] = await Promise.all([
          paymentMethodsRes.json(),
          plansRes.json(),
        ]);

        setPaymentMethods(paymentMethodsData);
        setPlans(plansData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleAddPaymentMethod = async () => {
    try {
      const response = await fetch('/api/payment-methods/create', {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error('Failed to create payment method');
      }

      const { url } = await response.json();
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add payment method');
    }
  };

  const handleDeletePaymentMethod = async (paymentMethodId: string) => {
    try {
      const response = await fetch(`/api/payment-methods/${paymentMethodId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete payment method');
      }

      setPaymentMethods(paymentMethods.filter(method => method.id !== paymentMethodId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete payment method');
    }
  };

  const handleSetDefaultPaymentMethod = async (paymentMethodId: string) => {
    try {
      const response = await fetch(`/api/payment-methods/${paymentMethodId}/default`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to set default payment method');
      }

      setPaymentMethods(paymentMethods.map(method => ({
        ...method,
        isDefault: method.id === paymentMethodId,
      })));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set default payment method');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-red-500">
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Billing Management</h1>

      {/* Payment Methods */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Methods</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {paymentMethods.map((method) => (
              <div
                key={method.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex items-center space-x-4">
                  <CreditCard className="h-6 w-6" />
                  <div>
                    <p className="font-medium">
                      {method.brand.charAt(0).toUpperCase() + method.brand.slice(1)} •••• {method.last4}
                    </p>
                    <p className="text-sm text-gray-500">
                      Expires {method.expMonth}/{method.expYear}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {!method.isDefault && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSetDefaultPaymentMethod(method.id)}
                    >
                      Set as Default
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeletePaymentMethod(method.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            <Button onClick={handleAddPaymentMethod}>
              Add Payment Method
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Subscription Plans */}
      <Card>
        <CardHeader>
          <CardTitle>Available Plans</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className="border rounded-lg p-6 space-y-4"
              >
                <div>
                  <h3 className="text-lg font-medium">{plan.name}</h3>
                  <p className="text-2xl font-bold mt-2">
                    {formatCurrency(plan.price, plan.currency)}
                    <span className="text-sm text-gray-500">/{plan.interval}</span>
                  </p>
                </div>
                <ul className="space-y-2">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-center text-sm">
                      <span className="text-green-500 mr-2">✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button className="w-full">
                  Switch to {plan.name}
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 