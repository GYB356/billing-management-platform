import React from 'react';
import { Line } from 'react-chartjs-2';

interface BillingMetric {
  id: string;
  name: string;
  value: number;
  unit: string;
  trend: number;
  history: {
    date: string;
    value: number;
  }[];
}

interface BillingMetricsProps {
  metrics: BillingMetric[];
  period: 'day' | 'week' | 'month' | 'year';
}

export default function BillingMetrics({ metrics, period }: BillingMetricsProps) {
  const formatTrend = (trend: number) => {
    const isPositive = trend > 0;
    return {
      text: `${isPositive ? '+' : ''}${trend.toFixed(1)}%`,
      color: isPositive ? 'text-green-500' : 'text-red-500',
      icon: isPositive ? '↑' : '↓'
    };
  };

  const formatValue = (value: number, unit: string) => {
    if (unit === 'currency') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
      }).format(value);
    }
    return `${value.toLocaleString()} ${unit}`;
  };

  return (
    <div className="space-y-6">
      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((metric) => {
          const trend = formatTrend(metric.trend);
          return (
            <div
              key={metric.id}
              className="p-4 bg-white rounded-lg shadow hover:shadow-md transition-shadow"
            >
              <h3 className="text-sm font-medium text-gray-500">{metric.name}</h3>
              <div className="mt-2 flex items-baseline">
                <p className="text-2xl font-semibold text-gray-900">
                  {formatValue(metric.value, metric.unit)}
                </p>
                <span
                  className={`ml-2 text-sm font-medium ${trend.color} flex items-center`}
                >
                  {trend.icon} {trend.text}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {metrics.map((metric) => (
          <div key={metric.id} className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-lg font-medium mb-4">{metric.name} Trend</h3>
            <Line
              data={{
                labels: metric.history.map(h => h.date),
                datasets: [
                  {
                    label: metric.name,
                    data: metric.history.map(h => h.value),
                    fill: false,
                    borderColor: 'rgb(59, 130, 246)',
                    tension: 0.1
                  }
                ]
              }}
              options={{
                responsive: true,
                plugins: {
                  legend: {
                    display: false
                  },
                  tooltip: {
                    callbacks: {
                      label: (context) => {
                        return formatValue(context.parsed.y, metric.unit);
                      }
                    }
                  }
                },
                scales: {
                  y: {
                    beginAtZero: true,
                    ticks: {
                      callback: (value) => formatValue(Number(value), metric.unit)
                    }
                  }
                }
              }}
            />
          </div>
        ))}
      </div>

      {/* Period Selector */}
      <div className="flex justify-end space-x-2">
        {['day', 'week', 'month', 'year'].map((p) => (
          <button
            key={p}
            className={`px-3 py-1 rounded ${
              period === p
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>
    </div>
  );
} 