import { useState } from 'react';
import { DateRangePicker } from '@/components/DateRangePicker';
import { Card } from '@/components/ui/card';
import { useAnalytics } from '@/hooks/useAnalytics';
import RevenueChart from './RevenueChart';
import CustomerGrowthChart from './CustomerGrowthChart';
import MetricsGrid from './MetricsGrid';

export default function AnalyticsDashboard() {
  const [dateRange, setDateRange] = useState({
    from: new Date(new Date().setDate(new Date().getDate() - 30)),
    to: new Date(),
  });

  const { data, isLoading, error } = useAnalytics({
    startDate: dateRange.from,
    endDate: dateRange.to,
  });

  if (error) {
    return <div className="text-red-500">Error loading analytics data</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <DateRangePicker
          from={dateRange.from}
          to={dateRange.to}
          onChange={({ from, to }) => setDateRange({ from, to })}
        />
      </div>

      <MetricsGrid
        isLoading={isLoading}
        mrr={data?.mrr}
        churnRate={data?.churnRate}
        subscriptionCount={data?.subscriptionCount}
      />

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Revenue Trend</h3>
          <RevenueChart
            isLoading={isLoading}
            data={data?.revenueByDay}
          />
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Customer Growth</h3>
          <CustomerGrowthChart
            isLoading={isLoading}
            data={data?.customerGrowth}
          />
        </Card>
      </div>
    </div>
  );
}