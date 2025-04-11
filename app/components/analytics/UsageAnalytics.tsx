import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Icons } from '@/components/ui/icons';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import { startOfMonth, endOfMonth, format } from 'date-fns';

interface UsageData {
  period: {
    start: string;
    end: string;
  };
  metrics: {
    totalUsage: number;
    usageByPeriod: Array<{ date: string; usage: number }>;
    usageByResource: Array<{ resource: string; usage: number }>;
    costByResource: Array<{ resource: string; cost: number }>;
    projectedUsage: number;
    trendPercentage: number;
  };
  utilization: Array<{
    resource: string;
    utilized: number;
    limit: number;
  }>;
  summary: {
    totalCost: number;
    averageDailyUsage: number;
    projectedUsage: number;
    trendPercentage: number;
  };
}

export function UsageAnalytics() {
  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const [dateRange, setDateRange] = useState({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUsageData = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams({
          startDate: dateRange.from.toISOString(),
          endDate: dateRange.to.toISOString(),
        });

        const response = await fetch(`/api/analytics/usage?${params}`);
        if (!response.ok) throw new Error('Failed to fetch usage data');
        
        const data = await response.json();
        setUsageData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchUsageData();
  }, [dateRange]);

  const handleExport = async () => {
    // Implement CSV export functionality
  };

  if (loading) return <div>Loading usage analytics...</div>;
  if (error) return <div className="text-red-500">Error: {error}</div>;
  if (!usageData) return null;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Usage Analytics</h2>
        <div className="flex items-center space-x-4">
          <DateRangePicker
            value={dateRange}
            onChange={setDateRange}
          />
          <Button onClick={handleExport} variant="outline">
            <Icons.download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-sm text-gray-500">Total Usage</p>
          <p className="text-2xl font-bold">{usageData.metrics.totalUsage.toLocaleString()}</p>
          <p className="text-sm text-gray-500">
            {usageData.metrics.trendPercentage >= 0 ? '+' : ''}
            {usageData.metrics.trendPercentage.toFixed(1)}% vs previous period
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-500">Average Daily Usage</p>
          <p className="text-2xl font-bold">
            {usageData.summary.averageDailyUsage.toLocaleString()}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-500">Projected Usage</p>
          <p className="text-2xl font-bold">
            {usageData.metrics.projectedUsage.toLocaleString()}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-500">Total Cost</p>
          <p className="text-2xl font-bold">
            {new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: 'USD',
            }).format(usageData.summary.totalCost)}
          </p>
        </Card>
      </div>

      {/* Usage Over Time Chart */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Usage Over Time</h3>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={usageData.metrics.usageByPeriod}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickFormatter={(date) => format(new Date(date), 'MMM dd')}
              />
              <YAxis />
              <Tooltip
                labelFormatter={(date) => format(new Date(date), 'MMM dd, yyyy')}
              />
              <Line
                type="monotone"
                dataKey="usage"
                stroke="#2563eb"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Resource Utilization */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Resource Utilization</h3>
        <div className="space-y-4">
          {usageData.utilization.map((resource) => (
            <div key={resource.resource} className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{resource.resource}</span>
                <span>
                  {resource.utilized.toLocaleString()} / {resource.limit.toLocaleString()}
                </span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full">
                <div
                  className="h-2 bg-blue-600 rounded-full"
                  style={{
                    width: `${Math.min(
                      (resource.utilized / resource.limit) * 100,
                      100
                    )}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Cost by Resource */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Cost by Resource</h3>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={usageData.metrics.costByResource}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="resource" />
              <YAxis
                tickFormatter={(value) =>
                  new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'USD',
                    minimumFractionDigits: 0,
                  }).format(value)
                }
              />
              <Tooltip
                formatter={(value) =>
                  new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'USD',
                  }).format(value as number)
                }
              />
              <Bar dataKey="cost" fill="#2563eb" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
} 