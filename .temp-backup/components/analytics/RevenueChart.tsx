import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card } from '@/components/ui/card';

interface RevenueChartProps {
  isLoading: boolean;
  data?: Array<{
    date: string;
    revenue: number;
  }>;
}

export default function RevenueChart({ isLoading, data }: RevenueChartProps) {
  if (isLoading) {
    return (
      <Card className="w-full h-[350px] flex items-center justify-center">
        <div className="animate-pulse">Loading...</div>
      </Card>
    );
  }

  const chartData = data?.map(item => ({
    date: new Date(item.date).toLocaleDateString(),
    revenue: item.revenue,
  }));

  return (
    <ResponsiveContainer width="100%" height={350}>
      <LineChart data={chartData}>
        <XAxis
          dataKey="date"
          stroke="#888888"
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          stroke="#888888"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => `$${value}`}
        />
        <Tooltip
          formatter={(value: number) => [`$${value.toLocaleString()}`, 'Revenue']}
          labelFormatter={(label) => `Date: ${label}`}
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
  );
}