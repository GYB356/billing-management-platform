'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useSession } from 'next-auth/react';
import { Loader2 } from 'lucide-react';
import { formatCurrency } from '@/lib/currency';

interface SubscriptionData {
  status: string;
  plan: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  amount: number;
  currency: string;
}

interface UsageData {
  total: number;
  limit: number;
  remaining: number;
  type: string;
}

export default function CustomerPortalDashboard() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [usage, setUsage] = useState<UsageData[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [subscriptionRes, usageRes] = await Promise.all([
          fetch('/api/subscription'),
          fetch('/api/usage'),
        ]);

        if (!subscriptionRes.ok || !usageRes.ok) {
          throw new Error('Failed to fetch data');
        }

        const [subscriptionData, usageData] = await Promise.all([
          subscriptionRes.json(),
          usageRes.json(),
        ]);

        setSubscription(subscriptionData);
        setUsage(usageData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

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
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Button
          onClick={() => window.location.href = '/customer-portal/billing'}
        >
          Manage Subscription
        </Button>
      </div>

      {/* Subscription Status */}
      <Card>
        <CardHeader>
          <CardTitle>Subscription Status</CardTitle>
        </CardHeader>
        <CardContent>
          {subscription ? (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-gray-500">Current Plan</p>
                  <p className="font-medium">{subscription.plan}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">Status</p>
                  <p className={`font-medium ${
                    subscription.status === 'active' ? 'text-green-500' : 'text-yellow-500'
                  }`}>
                    {subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1)}
                  </p>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-gray-500">Next Billing Date</p>
                  <p className="font-medium">
                    {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">Amount</p>
                  <p className="font-medium">
                    {formatCurrency(subscription.amount, subscription.currency)}
                  </p>
                </div>
              </div>
              {subscription.cancelAtPeriodEnd && (
                <div className="bg-yellow-50 p-4 rounded-md">
                  <p className="text-sm text-yellow-700">
                    Your subscription will be canceled at the end of the current period.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-gray-500">No active subscription</p>
          )}
        </CardContent>
      </Card>

      {/* Usage Statistics */}
      <Card>
        <CardHeader>
          <CardTitle>Usage Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {usage.map((item) => (
              <div key={item.type} className="space-y-2">
                <div className="flex justify-between items-center">
                  <p className="font-medium capitalize">{item.type}</p>
                  <p className="text-sm text-gray-500">
                    {item.total} / {item.limit}
                  </p>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full"
                    style={{
                      width: `${Math.min((item.total / item.limit) * 100, 100)}%`,
                    }}
                  />
                </div>
                {item.remaining < item.limit * 0.1 && (
                  <p className="text-sm text-yellow-600">
                    You're approaching your usage limit
                  </p>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Add recent activity items here */}
            <p className="text-gray-500">No recent activity</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 