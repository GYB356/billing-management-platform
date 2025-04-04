'use client';

import { useQuery } from '@tanstack/react-query';
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

async function getAnalytics() {
  const response = await fetch('/api/admin/subscriptions/analytics');
  if (!response.ok) {
    throw new Error('Failed to fetch analytics');
  }
  return response.json();
}

export default function SubscriptionAnalytics() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['subscription-analytics'],
    queryFn: getAnalytics,
  });

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-64 bg-gray-200 rounded"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-600">
        Failed to load subscription analytics
      </div>
    );
  }

  const chartData = {
    labels: ['Total', 'Active', 'Trial', 'Canceled'],
    datasets: [
      {
        label: 'Subscriptions',
        data: [
          data.totalSubscriptions,
          data.activeSubscriptions,
          data.trialSubscriptions,
          data.canceledSubscriptions,
        ],
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

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: 'Subscription Distribution',
      },
    },
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <dt className="text-sm font-medium text-gray-500 truncate">
              Total Subscriptions
            </dt>
            <dd className="mt-1 text-3xl font-semibold text-gray-900">
              {data.totalSubscriptions}
            </dd>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <dt className="text-sm font-medium text-gray-500 truncate">
              Monthly Revenue
            </dt>
            <dd className="mt-1 text-3xl font-semibold text-gray-900">
              ${(data.monthlyRevenue / 100).toFixed(2)}
            </dd>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <dt className="text-sm font-medium text-gray-500 truncate">
              Churn Rate
            </dt>
            <dd className="mt-1 text-3xl font-semibold text-gray-900">
              {data.churnRate.toFixed(1)}%
            </dd>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <dt className="text-sm font-medium text-gray-500 truncate">
              Conversion Rate
            </dt>
            <dd className="mt-1 text-3xl font-semibold text-gray-900">
              {data.conversionRate.toFixed(1)}%
            </dd>
          </div>
        </div>
      </div>

      <div className="bg-white overflow-hidden shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <Bar data={chartData} options={chartOptions} />
        </div>
      </div>
    </div>
  );
} 