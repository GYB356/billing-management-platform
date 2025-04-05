import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface FinancialMetrics {
  mrr: number;
  arr: number;
  ltv: number;
  churnRate: number;
  revenueByPlan: Record<string, number>;
  historicalMrr: {
    labels: string[];
    data: number[];
  };
  cohortRetention: {
    labels: string[];
    data: number[];
  };
}

async function getFinancialMetrics(): Promise<FinancialMetrics> {
  const response = await fetch('/api/analytics/financial');
  if (!response.ok) {
    throw new Error('Failed to fetch financial metrics');
  }
  return response.json();
}

export default function FinancialDashboard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['financial-metrics'],
    queryFn: getFinancialMetrics,
    refetchInterval: 300000, // Refresh every 5 minutes
  });

  if (isLoading) {
    return <Skeleton className="w-full h-96" />;
  }

  if (error) {
    return <div>Error loading financial metrics</div>;
  }

  const mrrChartData = {
    labels: data.historicalMrr.labels,
    datasets: [
      {
        label: 'Monthly Recurring Revenue',
        data: data.historicalMrr.data,
        fill: true,
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4,
      },
    ],
  };

  const retentionChartData = {
    labels: data.cohortRetention.labels,
    datasets: [
      {
        label: 'Cohort Retention',
        data: data.cohortRetention.data,
        backgroundColor: 'rgb(16, 185, 129)',
      },
    ],
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-6">
          <h3 className="text-sm font-medium text-gray-500">MRR</h3>
          <p className="mt-2 text-3xl font-semibold text-gray-900">
            ${data.mrr.toLocaleString()}
          </p>
        </Card>

        <Card className="p-6">
          <h3 className="text-sm font-medium text-gray-500">ARR</h3>
          <p className="mt-2 text-3xl font-semibold text-gray-900">
            ${data.arr.toLocaleString()}
          </p>
        </Card>

        <Card className="p-6">
          <h3 className="text-sm font-medium text-gray-500">LTV</h3>
          <p className="mt-2 text-3xl font-semibold text-gray-900">
            ${data.ltv.toLocaleString()}
          </p>
        </Card>

        <Card className="p-6">
          <h3 className="text-sm font-medium text-gray-500">Churn Rate</h3>
          <p className="mt-2 text-3xl font-semibold text-gray-900">
            {data.churnRate.toFixed(1)}%
          </p>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h3 className="text-lg font-medium mb-4">Revenue Growth</h3>
          <div className="h-80">
            <Line data={mrrChartData} options={{ maintainAspectRatio: false }} />
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-medium mb-4">Cohort Retention</h3>
          <div className="h-80">
            <Bar data={retentionChartData} options={{ maintainAspectRatio: false }} />
          </div>
        </Card>
      </div>
    </div>
  );
}