import React, { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { Card, Select, DateRangePicker } from '@/components/ui';
import { AggregatedMetrics } from '@/lib/services/metrics-collector';

interface MetricData {
  name: string;
  value: number;
  timestamp: string;
}

interface UsageMetricsDashboardProps {
  metricNames: string[];
  initialMetricName?: string;
}

export default function UsageMetricsDashboard({
  metricNames,
  initialMetricName
}: UsageMetricsDashboardProps) {
  const [selectedMetric, setSelectedMetric] = useState(initialMetricName || metricNames[0]);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
    endDate: new Date()
  });
  const [metrics, setMetrics] = useState<MetricData[]>([]);
  const [aggregatedData, setAggregatedData] = useState<AggregatedMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const params = new URLSearchParams({
          name: selectedMetric,
          startTime: dateRange.startDate.toISOString(),
          endTime: dateRange.endDate.toISOString()
        });

        const response = await fetch(`/api/metrics/query?${params}`);
        if (!response.ok) {
          throw new Error('Failed to fetch metrics');
        }

        const data = await response.json();
        setMetrics(data.metrics || []);
        setAggregatedData(data.aggregatedUsage || null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    fetchMetrics();
  }, [selectedMetric, dateRange]);

  const formatValue = (value: number) => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    }
    return value.toFixed(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Select
            value={selectedMetric}
            onChange={(e) => setSelectedMetric(e.target.value)}
            options={metricNames.map(name => ({ value: name, label: name }))}
            label="Metric"
          />
          <DateRangePicker
            startDate={dateRange.startDate}
            endDate={dateRange.endDate}
            onChange={setDateRange}
          />
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-md">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="h-96 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
        </div>
      ) : (
        <>
          <Card>
            <div className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={metrics}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="timestamp"
                    tickFormatter={(timestamp) => new Date(timestamp).toLocaleDateString()}
                  />
                  <YAxis tickFormatter={formatValue} />
                  <Tooltip
                    formatter={(value: number) => formatValue(value)}
                    labelFormatter={(timestamp) => new Date(timestamp).toLocaleString()}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#2563eb"
                    name={selectedMetric}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {aggregatedData && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <div className="p-4">
                  <h3 className="text-sm font-medium text-gray-500">Total</h3>
                  <p className="mt-1 text-2xl font-semibold">
                    {formatValue(aggregatedData.sum)}
                  </p>
                </div>
              </Card>
              <Card>
                <div className="p-4">
                  <h3 className="text-sm font-medium text-gray-500">Average</h3>
                  <p className="mt-1 text-2xl font-semibold">
                    {formatValue(aggregatedData.avg)}
                  </p>
                </div>
              </Card>
              <Card>
                <div className="p-4">
                  <h3 className="text-sm font-medium text-gray-500">Peak</h3>
                  <p className="mt-1 text-2xl font-semibold">
                    {formatValue(aggregatedData.max)}
                  </p>
                </div>
              </Card>
              <Card>
                <div className="p-4">
                  <h3 className="text-sm font-medium text-gray-500">95th Percentile</h3>
                  <p className="mt-1 text-2xl font-semibold">
                    {formatValue(aggregatedData.p95 || 0)}
                  </p>
                </div>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}