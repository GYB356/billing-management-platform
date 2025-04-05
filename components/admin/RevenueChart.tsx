'use client';

import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface Transaction {
  amount: number;
  created: number;
  type: string;
}

interface RevenueChartProps {
  transactions: Transaction[];
}

export default function RevenueChart({ transactions }: RevenueChartProps) {
  const data = useMemo(() => {
    const dailyRevenue = transactions.reduce((acc, transaction) => {
      if (transaction.type === 'charge') {
        const date = new Date(transaction.created * 1000).toLocaleDateString();
        acc[date] = (acc[date] || 0) + transaction.amount / 100;
      }
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(dailyRevenue)
      .map(([date, amount]) => ({ date, amount }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [transactions]);

  return (
    <div className="h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip />
          <Line
            type="monotone"
            dataKey="amount"
            stroke="#8884d8"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
} 