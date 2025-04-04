'use client';

import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface CustomerMetricsProps {
  metrics: {
    total: number;
    withActiveSubscription: number;
    withTrial: number;
    churnRate: number;
  };
}

export default function CustomerMetrics({ metrics }: CustomerMetricsProps) {
  const data = useMemo(() => {
    return [
      {
        name: 'Total Customers',
        value: metrics.total,
      },
      {
        name: 'Active Subscriptions',
        value: metrics.withActiveSubscription,
      },
      {
        name: 'Trial Users',
        value: metrics.withTrial,
      },
      {
        name: 'Churn Rate',
        value: metrics.churnRate,
      },
    ];
  }, [metrics]);

  return (
    <div className="h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="value" fill="#8884d8" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
} 