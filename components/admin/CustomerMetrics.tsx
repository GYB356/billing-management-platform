'use client';

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface CustomerMetricsProps {
  metrics: {
    total: number;
    withActiveSubscription: number;
    withTrial: number;
    churnRate: number;
  };
}

export default function CustomerMetrics({ metrics }: CustomerMetricsProps) {
  const data = {
    labels: ['Total Customers', 'Active Subscribers', 'Trial Users'],
    datasets: [
      {
        label: 'Customer Metrics',
        data: [
          metrics.total,
          metrics.withActiveSubscription,
          metrics.withTrial,
        ],
        backgroundColor: [
          'rgba(59, 130, 246, 0.5)',
          'rgba(16, 185, 129, 0.5)',
          'rgba(245, 158, 11, 0.5)',
        ],
        borderColor: [
          'rgb(59, 130, 246)',
          'rgb(16, 185, 129)',
          'rgb(245, 158, 11)',
        ],
        borderWidth: 1,
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: true,
        text: 'Customer Overview',
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="h-[300px]">
        <Bar data={data} options={options} />
      </div>

      <div className="space-y-4">
        <div className="bg-gray-50 p-4 rounded-lg">
          <h4 className="text-sm font-medium text-gray-500">Customer Statistics</h4>
          <dl className="mt-2 space-y-2">
            <div className="flex justify-between">
              <dt className="text-sm text-gray-600">Total Customers</dt>
              <dd className="text-sm font-medium text-gray-900">{metrics.total}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-gray-600">Active Subscribers</dt>
              <dd className="text-sm font-medium text-gray-900">
                {metrics.withActiveSubscription}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-gray-600">Trial Users</dt>
              <dd className="text-sm font-medium text-gray-900">{metrics.withTrial}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-gray-600">Churn Rate</dt>
              <dd className="text-sm font-medium text-gray-900">
                {metrics.churnRate.toFixed(1)}%
              </dd>
            </div>
          </dl>
        </div>

        <div className="bg-gray-50 p-4 rounded-lg">
          <h4 className="text-sm font-medium text-gray-500">Conversion Metrics</h4>
          <dl className="mt-2 space-y-2">
            <div className="flex justify-between">
              <dt className="text-sm text-gray-600">Trial to Paid</dt>
              <dd className="text-sm font-medium text-gray-900">
                {metrics.withTrial > 0
                  ? `${((metrics.withActiveSubscription / metrics.withTrial) * 100).toFixed(1)}%`
                  : '0%'}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-gray-600">Active Rate</dt>
              <dd className="text-sm font-medium text-gray-900">
                {metrics.total > 0
                  ? `${((metrics.withActiveSubscription / metrics.total) * 100).toFixed(1)}%`
                  : '0%'}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
} 