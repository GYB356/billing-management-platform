'use client';

import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  ChartData,
  ChartOptions,
} from 'chart.js';
import { Pie } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend);

interface SubscriptionMetricsProps {
  metrics: {
    total: number;
    active: number;
    trialing: number;
    canceled: number;
    byPlan: Record<string, number>;
  };
}

export default function SubscriptionMetrics({ metrics }: SubscriptionMetricsProps) {
  const data: ChartData<'pie'> = {
    labels: Object.keys(metrics.byPlan),
    datasets: [
      {
        data: Object.values(metrics.byPlan),
        backgroundColor: [
          'rgba(59, 130, 246, 0.5)',
          'rgba(16, 185, 129, 0.5)',
          'rgba(245, 158, 11, 0.5)',
          'rgba(239, 68, 68, 0.5)',
        ],
        borderColor: [
          'rgb(59, 130, 246)',
          'rgb(16, 185, 129)',
          'rgb(245, 158, 11)',
          'rgb(239, 68, 68)',
        ],
        borderWidth: 1,
      },
    ],
  };

  const options: ChartOptions<'pie'> = {
    responsive: true,
    plugins: {
      legend: {
        position: 'right' as const,
      },
    },
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="h-[300px]">
        <Pie data={data} options={options} />
      </div>
      
      <div className="space-y-4">
        <div className="bg-gray-50 p-4 rounded-lg">
          <h4 className="text-sm font-medium text-gray-500">Subscription Status</h4>
          <dl className="mt-2 space-y-2">
            <div className="flex justify-between">
              <dt className="text-sm text-gray-600">Active</dt>
              <dd className="text-sm font-medium text-gray-900">{metrics.active}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-gray-600">Trialing</dt>
              <dd className="text-sm font-medium text-gray-900">{metrics.trialing}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-gray-600">Canceled</dt>
              <dd className="text-sm font-medium text-gray-900">{metrics.canceled}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-gray-600">Total</dt>
              <dd className="text-sm font-medium text-gray-900">{metrics.total}</dd>
            </div>
          </dl>
        </div>

        <div className="bg-gray-50 p-4 rounded-lg">
          <h4 className="text-sm font-medium text-gray-500">Plan Distribution</h4>
          <dl className="mt-2 space-y-2">
            {Object.entries(metrics.byPlan).map(([plan, count]) => (
              <div key={plan} className="flex justify-between">
                <dt className="text-sm text-gray-600">{plan}</dt>
                <dd className="text-sm font-medium text-gray-900">{count}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  );
} 