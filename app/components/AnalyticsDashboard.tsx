import { useEffect, useState } from 'react';
import { LineChart } from './charts/LineChart';

interface AnalyticsData {
  mrr: number;
  churnRate: number;
  planDistribution: Array<{ plan: string; count: number }>;
  revenueTimeline: Array<{ month: string; revenue: number }>;
}

export function AnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const response = await fetch('/api/analytics');
        if (!response.ok) throw new Error('Failed to fetch analytics');
        const analyticsData = await response.json();
        setData(analyticsData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, []);

  if (loading) return <div className="p-4">Loading analytics...</div>;
  if (error) return <div className="p-4 text-red-500">Error: {error}</div>;
  if (!data) return null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Subscription Analytics</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* MRR Card */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-700">Monthly Recurring Revenue</h3>
          <p className="text-3xl font-bold text-blue-600 mt-2">
            {formatCurrency(data.mrr)}
          </p>
        </div>

        {/* Churn Rate Card */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-700">Churn Rate</h3>
          <p className="text-3xl font-bold text-blue-600 mt-2">
            {data.churnRate.toFixed(2)}%
          </p>
        </div>
      </div>

      {/* Revenue Timeline Chart */}
      <LineChart
        data={data.revenueTimeline}
        xKey="month"
        yKey="revenue"
        title="Revenue Timeline"
      />

      {/* Plan Distribution */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">Plan Distribution</h3>
        <div className="space-y-4">
          {data.planDistribution.map((plan) => (
            <div key={plan.plan} className="flex items-center justify-between">
              <span className="text-gray-600">{plan.plan}</span>
              <span className="font-semibold">{plan.count} subscribers</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 