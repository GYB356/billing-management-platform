'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { format } from 'date-fns';
import { useSubscription } from '@/contexts/subscription-context';
import { SubscriptionAnalyticsLoading } from '@/components/subscription/loading';
import { SubscriptionErrorBoundary } from '@/components/subscription/error-boundary';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface AnalyticsData {
  currentPlan: string;
  status: string;
  startDate: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  totalUsage: number;
  usageByFeature: Record<string, { total: number; records: Array<{ date: string; quantity: number }> }>;
  subscriptionHistory: Array<{
    plan: string;
    status: string;
    startDate: string;
    endDate: string | null;
    createdAt: string;
  }>;
}

export default function SubscriptionAnalytics() {
  const { subscription, loading: subscriptionLoading } = useSubscription();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [dateRange, setDateRange] = useState<{
    from: Date;
    to: Date;
  } | null>(null);

  const fetchAnalytics = async () => {
    if (!subscription) return;

    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (dateRange?.from) {
        params.append('startDate', dateRange.from.toISOString());
      }
      if (dateRange?.to) {
        params.append('endDate', dateRange.to.toISOString());
      }

      const response = await fetch(`/api/subscription/analytics?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch analytics data');
      }

      const analyticsData = await response.json();
      setData(analyticsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (subscription) {
      fetchAnalytics();
    }
  }, [subscription, dateRange]);

  if (subscriptionLoading || loading) {
    return <SubscriptionAnalyticsLoading />;
  }

  if (!subscription) {
    return (
      <Alert variant="destructive">
        <AlertDescription>No active subscription found</AlertDescription>
      </Alert>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!data) {
    return (
      <Alert variant="warning">
        <AlertDescription>No analytics data available</AlertDescription>
      </Alert>
    );
  }

  return (
    <SubscriptionErrorBoundary>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Subscription Analytics</h1>
          <DateRangePicker
            value={dateRange}
            onChange={setDateRange}
            placeholder="Select date range"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4">
            <h3 className="text-sm font-medium text-gray-500">Current Plan</h3>
            <p className="text-2xl font-semibold">{data.currentPlan}</p>
          </Card>
          <Card className="p-4">
            <h3 className="text-sm font-medium text-gray-500">Status</h3>
            <p className="text-2xl font-semibold capitalize">{data.status}</p>
          </Card>
          <Card className="p-4">
            <h3 className="text-sm font-medium text-gray-500">Total Usage</h3>
            <p className="text-2xl font-semibold">{data.totalUsage}</p>
          </Card>
          <Card className="p-4">
            <h3 className="text-sm font-medium text-gray-500">Period End</h3>
            <p className="text-2xl font-semibold">
              {format(new Date(data.currentPeriodEnd), 'MMM d, yyyy')}
            </p>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Usage by Feature</h2>
            <div className="space-y-4">
              {Object.entries(data.usageByFeature).map(([feature, usage]) => (
                <div key={feature} className="border-b pb-4 last:border-0">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">{feature}</span>
                    <span className="text-gray-600">{usage.total}</span>
                  </div>
                  <div className="mt-2 text-sm text-gray-500">
                    Last recorded: {format(new Date(usage.records[0]?.date || ''), 'MMM d, yyyy')}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Subscription History</h2>
            <div className="space-y-4">
              {data.subscriptionHistory.map((history, index) => (
                <div key={index} className="border-b pb-4 last:border-0">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">{history.plan}</span>
                    <span className="capitalize text-sm text-gray-600">{history.status}</span>
                  </div>
                  <div className="mt-2 text-sm text-gray-500">
                    {format(new Date(history.startDate), 'MMM d, yyyy')} -{' '}
                    {history.endDate
                      ? format(new Date(history.endDate), 'MMM d, yyyy')
                      : 'Present'}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </SubscriptionErrorBoundary>
  );
} 