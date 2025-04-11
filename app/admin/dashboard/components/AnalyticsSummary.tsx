'use client';

import { Card } from '@/components/ui/card';
import { ArrowUpIcon, ArrowDownIcon } from '@heroicons/react/24/solid';
import { formatCurrency } from '@/utils/currency';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface MetricCardProps {
  title: string;
  value: string;
  change: number;
  trend: 'up' | 'down' | 'neutral';
}

function MetricCard({ title, value, change, trend }: MetricCardProps) {
  return (
    <Card className="p-6">
      <h3 className="text-sm font-medium text-gray-500">{title}</h3>
      <div className="mt-2 flex items-baseline">
        <p className="text-2xl font-semibold text-gray-900">{value}</p>
        <p className={`ml-2 flex items-baseline text-sm font-semibold ${
          trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-gray-500'
        }`}>
          {trend === 'up' ? (
            <ArrowUpIcon className="h-4 w-4 flex-shrink-0 self-center text-green-500" />
          ) : trend === 'down' ? (
            <ArrowDownIcon className="h-4 w-4 flex-shrink-0 self-center text-red-500" />
          ) : null}
          <span className="ml-1">{Math.abs(change)}%</span>
        </p>
      </div>
    </Card>
  );
}

export interface AnalyticsSummaryProps {
  metrics: {
    mrr: number;
    arr: number;
    activeSubscriptions: number;
    churnRate: number;
  };
  revenueData: Array<{
    date: string;
    revenue: number;
  }>;
}

export default function AnalyticsSummary({ metrics, revenueData }: AnalyticsSummaryProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Monthly Recurring Revenue"
          value={formatCurrency(metrics.mrr)}
          change={5.5}
          trend="up"
        />
        <MetricCard
          title="Annual Recurring Revenue"
          value={formatCurrency(metrics.arr)}
          change={12.3}
          trend="up"
        />
        <MetricCard
          title="Active Subscriptions"
          value={metrics.activeSubscriptions.toString()}
          change={2.1}
          trend="up"
        />
        <MetricCard
          title="Churn Rate"
          value={`${metrics.churnRate.toFixed(1)}%`}
          change={-0.5}
          trend="down"
        />
      </div>

      <Card className="p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Revenue Trend</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={revenueData}>
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short' })}
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => formatCurrency(value, { notation: 'compact' })}
              />
              <Tooltip 
                formatter={(value: number) => formatCurrency(value)}
                labelFormatter={(label) => new Date(label).toLocaleDateString('en-US', { 
                  month: 'long',
                  year: 'numeric'
                })}
              />
              <Line 
                type="monotone" 
                dataKey="revenue" 
                stroke="#2563eb" 
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
