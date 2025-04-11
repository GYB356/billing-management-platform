import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils';

interface Subscription {
  id: string;
  status: string;
  planName: string;
  currentPeriodEnd: string;
  price: number;
  currency: string;
  usage?: {
    current: number;
    limit: number;
    unit: string;
  };
}

export function SubscriptionManager() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSubscription = async () => {
      try {
        const response = await fetch('/api/subscriptions/current');
        if (!response.ok) throw new Error('Failed to fetch subscription');
        const data = await response.json();
        setSubscription(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchSubscription();
  }, []);

  const handleUpgrade = async () => {
    // Implement upgrade flow
  };

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel your subscription?')) return;
    
    try {
      const response = await fetch('/api/subscriptions/cancel', {
        method: 'POST',
      });
      
      if (!response.ok) throw new Error('Failed to cancel subscription');
      
      // Refresh subscription data
      const data = await response.json();
      setSubscription(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel subscription');
    }
  };

  if (loading) return <div>Loading subscription details...</div>;
  if (error) return <div className="text-red-500">Error: {error}</div>;
  if (!subscription) return <div>No active subscription found.</div>;

  return (
    <Card className="p-6">
      <div className="space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-xl font-semibold text-gray-900">Current Plan</h3>
            <p className="text-sm text-gray-500">{subscription.planName}</p>
          </div>
          <Badge variant={subscription.status === 'active' ? 'success' : 'secondary'}>
            {subscription.status}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-500">Price</p>
            <p className="text-lg font-semibold">
              {new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: subscription.currency,
              }).format(subscription.price)}
              <span className="text-sm text-gray-500">/month</span>
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Current Period Ends</p>
            <p className="text-lg font-semibold">
              {formatDate(new Date(subscription.currentPeriodEnd))}
            </p>
          </div>
        </div>

        {subscription.usage && (
          <div className="mt-4">
            <p className="text-sm text-gray-500 mb-2">Usage</p>
            <div className="bg-gray-100 rounded-full h-2 w-full">
              <div
                className="bg-blue-600 h-2 rounded-full"
                style={{
                  width: `${Math.min(
                    (subscription.usage.current / subscription.usage.limit) * 100,
                    100
                  )}%`,
                }}
              />
            </div>
            <p className="text-sm text-gray-600 mt-1">
              {subscription.usage.current} / {subscription.usage.limit} {subscription.usage.unit}
            </p>
          </div>
        )}

        <div className="flex space-x-4">
          <Button onClick={handleUpgrade} variant="default">
            Upgrade Plan
          </Button>
          <Button onClick={handleCancel} variant="destructive">
            Cancel Subscription
          </Button>
        </div>
      </div>
    </Card>
  );
} 