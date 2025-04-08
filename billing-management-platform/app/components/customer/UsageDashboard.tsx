'use client';

import { useState } from "react";
import useSWR from "swr";

interface UsageMetric {
  metric: string;
  usage: number;
  unit: string;
  limit?: number;
  description?: string;
}

interface UsageData {
  metrics: UsageMetric[];
  periodStart: string;
  periodEnd: string;
}

export default function UsageDashboard() {
  const { data, error, isLoading } = useSWR<UsageData>("/api/customer/usage");
  const [expandedMetric, setExpandedMetric] = useState<string | null>(null);

  const getUsagePercentage = (usage: number, limit?: number) => {
    if (!limit) return 0;
    return Math.min((usage / limit) * 100, 100);
  };

  if (error) {
    return (
      <div className="bg-white shadow-md p-6 rounded-xl border border-gray-200">
        <h2 className="text-xl font-semibold mb-4">Usage Summary</h2>
        <p className="text-red-600">Failed to load usage data</p>
      </div>
    );
  }

  return (
    <div className="bg-white shadow-md p-6 rounded-xl border border-gray-200">
      <h2 className="text-xl font-semibold mb-6">Usage Summary</h2>
      
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
              <div className="h-2 bg-gray-200 rounded w-full"></div>
            </div>
          ))}
        </div>
      ) : data?.metrics.length ? (
        <div className="space-y-6">
          {data.metrics.map((m) => (
            <div key={m.metric} className="space-y-2">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-medium">{m.metric}</h3>
                  {m.description && (
                    <p className="text-sm text-gray-500">{m.description}</p>
                  )}
                </div>
                <button
                  onClick={() => setExpandedMetric(expandedMetric === m.metric ? null : m.metric)}
                  className="text-blue-600 hover:text-blue-700 text-sm"
                >
                  {expandedMetric === m.metric ? 'Less' : 'More'}
                </button>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full"
                      style={{ width: `${getUsagePercentage(m.usage, m.limit)}%` }}
                    ></div>
                  </div>
                </div>
                <div className="text-sm whitespace-nowrap">
                  {m.usage.toLocaleString()} / {m.limit?.toLocaleString() || '∞'} {m.unit}
                </div>
              </div>

              {expandedMetric === m.metric && (
                <div className="mt-2 p-4 bg-gray-50 rounded-lg text-sm space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Current Usage:</span>
                    <span>{m.usage.toLocaleString()} {m.unit}</span>
                  </div>
                  {m.limit && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Usage Limit:</span>
                      <span>{m.limit.toLocaleString()} {m.unit}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-600">Usage Percentage:</span>
                    <span>{getUsagePercentage(m.usage, m.limit).toFixed(1)}%</span>
                  </div>
                </div>
              )}
            </div>
          ))}

          <div className="text-xs text-gray-500 mt-4">
            Period: {new Date(data.periodStart).toLocaleDateString()} - {new Date(data.periodEnd).toLocaleDateString()}
          </div>
        </div>
      ) : (
        <p className="text-gray-500 text-center py-4">No usage data available</p>
      )}
    </div>
  );
} 