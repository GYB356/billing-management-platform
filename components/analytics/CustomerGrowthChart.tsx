import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card } from '@/components/ui/card';

interface CustomerGrowthChartProps {
  isLoading: boolean;
  data?: Array<{
    date: string;
    newCustomers: number;
  }>;
}

export default function CustomerGrowthChart({ isLoading, data }: CustomerGrowthChartProps) {
  if (isLoading) {
    return (
      <Card className="w-full h-[350px] flex items-center justify-center">
        <div className="animate-pulse">Loading...</div>
      </Card>
    );
  }

  const chartData = data?.map(item => ({
    date: new Date(item.date).toLocaleDateString(),
    newCustomers: item.newCustomers,
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
        />
        <Tooltip
          formatter={(value: number) => [value.toLocaleString(), 'New Customers']}
          labelFormatter={(label) => `Date: ${label}`}
        />
        <Line
          type="monotone"
          dataKey="newCustomers"
          stroke="#16a34a"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}