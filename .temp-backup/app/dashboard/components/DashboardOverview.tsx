'use client';

import { useState } from 'react';
import { ArrowUpIcon, ArrowDownIcon, CreditCardIcon, DocumentTextIcon, ChartBarIcon, BellIcon } from '@heroicons/react/24/outline';
import { formatCurrency } from '@/utils/currency';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useSubscription } from '@/hooks/useSubscription';
import { useBilling } from '@/hooks/useBilling';
import { useNotifications } from '@/hooks/useNotifications';
import { SubscriptionStatus } from '@prisma/client';

interface UsageMetric {
  name: string;
  current: number;
  limit: number;
  unit: string;
}

export default function DashboardOverview() {
  const { subscription, usage } = useSubscription();
  const { recentInvoices, balance } = useBilling();
  const { unreadCount } = useNotifications();
  
  const [usageMetrics, setUsageMetrics] = useState<UsageMetric[]>([]);

  const isActive = subscription?.status === SubscriptionStatus.ACTIVE;
  const daysUntilRenewal = subscription ? Math.ceil((new Date(subscription.currentPeriodEnd).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : 0;

  return (
    <div className="space-y-6">
      {/* Subscription Status */}
      <Card className="p-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold">Subscription Status</h2>
            <p className="text-sm text-gray-500">
              {isActive ? `Renews in ${daysUntilRenewal} days` : 'Inactive'}
            </p>
          </div>
          <Button variant="outline">
            Manage Subscription
          </Button>
        </div>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Current Balance</p>
              <h3 className="text-2xl font-bold">{formatCurrency(balance || 0)}</h3>
            </div>
            <CreditCardIcon className="h-8 w-8 text-gray-400" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Recent Invoices</p>
              <h3 className="text-2xl font-bold">{recentInvoices?.length || 0}</h3>
            </div>
            <DocumentTextIcon className="h-8 w-8 text-gray-400" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Notifications</p>
              <h3 className="text-2xl font-bold">{unreadCount}</h3>
            </div>
            <BellIcon className="h-8 w-8 text-gray-400" />
          </div>
        </Card>
      </div>

      {/* Usage Overview */}
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Resource Usage</h2>
            <ChartBarIcon className="h-6 w-6 text-gray-400" />
          </div>
          
          <div className="space-y-4">
            {usageMetrics.map((metric) => (
              <div key={metric.name} className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>{metric.name}</span>
                  <span>
                    {metric.current} / {metric.limit} {metric.unit}
                  </span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full">
                  <div
                    className="h-full bg-blue-500 rounded-full"
                    style={{ width: `${(metric.current / metric.limit) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Quick Actions */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Button variant="outline" className="w-full">
            View Invoices
          </Button>
          <Button variant="outline" className="w-full">
            Payment Methods
          </Button>
          <Button variant="outline" className="w-full">
            Usage Reports
          </Button>
          <Button variant="outline" className="w-full">
            Support
          </Button>
        </div>
      </Card>
    </div>
  );
}
