'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Card } from '@/components/ui/card';

interface UsageChartProps {
  data: Array<{
    date: string;
    usage: number;
    cost: number;
  }>;
}

export default function UsageChart({ data }: UsageChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart
        data={data}
        margin={{
          top: 5,
          right: 30,
          left: 20,
          bottom: 5,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis 
          dataKey="date" 
          tickFormatter={(date) => new Date(date).toLocaleDateString()}
        />
        <YAxis yAxisId="left" />
        <YAxis yAxisId="right" orientation="right" />
        <Tooltip
          labelFormatter={(date) => new Date(date).toLocaleDateString()}
          formatter={(value, name) => [
            name === 'cost' ? `$${value}` : value,
            name === 'cost' ? 'Cost' : 'Usage'
          ]}
        />
        <Legend />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="usage"
          stroke="#8884d8"
          name="Usage"
          strokeWidth={2}
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="cost"
          stroke="#82ca9d"
          name="Cost"
          strokeWidth={2}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}