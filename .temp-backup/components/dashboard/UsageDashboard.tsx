'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  ArrowDownIcon, 
  ArrowUpIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { getUsageSummary } from '@/lib/usage';

interface UsageDashboardProps {
  subscriptionId: string;
}

export default function UsageDashboard({ subscriptionId }: UsageDashboardProps) {
  const [timeframe, setTimeframe] = useState<'current' | 'last30days' | 'lastBilling'>('current');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['usage-summary', subscriptionId, timeframe],
    queryFn: async () => {
      const response = await fetch(`/api/dashboard/usage?subscriptionId=${subscriptionId}&timeframe=${timeframe}`);
      if (!response.ok) {
        throw new Error('Failed to fetch usage data');
      }
      return response.json();
    },
  });

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((_, i) => (
            <div key={i} className="bg-gray-100 p-6 rounded-lg">
              <div className="h-6 bg-gray-200 rounded w-3/4 mb-4"></div>
              <div className="h-20 bg-gray-200 rounded mb-4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <ExclamationTriangleIcon className="h-5 w-5 text-red-400" aria-hidden="true" />
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Error loading usage data</h3>
            <div className="mt-2 text-sm text-red-700">
              <p>Please try again later or contact support.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const { usageSummary, currentPeriodStart, currentPeriodEnd } = data || {};

  // Format dates for display
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center sm:justify-between">
        <h3 className="text-lg font-medium leading-6 text-gray-900">Usage Overview</h3>
        <div className="mt-3 sm:mt-0">
          <div className="flex rounded-md shadow-sm">
            <button
              type="button"
              onClick={() => setTimeframe('current')}
              className={`relative inline-flex items-center px-4 py-2 rounded-l-md border ${
                timeframe === 'current'
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                  : 'border-gray-300 bg-white text-gray-700'
              } text-sm font-medium focus:z-10 focus:outline-none focus:ring-1 focus:ring-indigo-500`}
            >
              Current Billing Period
            </button>
            <button
              type="button"
              onClick={() => setTimeframe('last30days')}
              className={`relative inline-flex items-center px-4 py-2 border ${
                timeframe === 'last30days'
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                  : 'border-gray-300 bg-white text-gray-700'
              } text-sm font-medium focus:z-10 focus:outline-none focus:ring-1 focus:ring-indigo-500`}
            >
              Last 30 Days
            </button>
            <button
              type="button"
              onClick={() => setTimeframe('lastBilling')}
              className={`relative inline-flex items-center px-4 py-2 rounded-r-md border ${
                timeframe === 'lastBilling'
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                  : 'border-gray-300 bg-white text-gray-700'
              } text-sm font-medium focus:z-10 focus:outline-none focus:ring-1 focus:ring-indigo-500`}
            >
              Previous Period
            </button>
          </div>
        </div>
      </div>

      {currentPeriodStart && currentPeriodEnd && (
        <div className="text-sm text-gray-500">
          {timeframe === 'current' && (
            <p>
              Current billing period: {formatDate(currentPeriodStart)} - {formatDate(currentPeriodEnd)}
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {usageSummary?.map((item) => (
          <div key={item.feature.id} className="bg-white overflow-hidden shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0 bg-indigo-500 rounded-md p-3">
                  <svg className="h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      {item.feature.name}
                    </dt>
                    <dd>
                      <div className="flex items-baseline">
                        <p className="text-2xl font-semibold text-gray-900">
                          {item.totalUsage.toLocaleString()}
                        </p>
                        <p className="ml-2 flex items-baseline text-sm font-semibold">
                          {item.feature.unitName || 'units'}
                        </p>
                      </div>
                    </dd>
                  </dl>
                </div>
              </div>

              <div className="mt-6">
                <div className="relative">
                  <div className="overflow-hidden h-2 text-xs flex rounded bg-gray-200">
                    <div
                      style={{ width: `${item.usagePercentage}%` }}
                      className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center
                        ${item.usagePercentage > 90 ? 'bg-red-500' : 
                          item.usagePercentage > 75 ? 'bg-yellow-500' : 'bg-green-500'}`}
                    ></div>
                  </div>
                </div>
                <div className="mt-1 flex justify-between text-xs text-gray-500">
                  <div>Used: {item.totalUsage}</div>
                  {item.usageLimit > 0 && (
                    <div>Limit: {item.usageLimit}</div>
                  )}
                </div>
              </div>

              {item.currentTier && (
                <div className="mt-4 text-sm">
                  <p className="text-gray-500">
                    Current tier: {item.currentTier.name || `Tier ${item.currentTier.id.slice(0, 4)}`}
                  </p>
                  {item.nextTier && (
                    <p className="text-gray-500">
                      Next tier at: {item.nextTier.fromQuantity.toLocaleString()} {item.feature.unitName || 'units'}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {(!usageSummary || usageSummary.length === 0) && (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No usage data</h3>
          <p className="mt-1 text-sm text-gray-500">
            Your subscription doesn't have any usage-based features or no usage has been recorded yet.
          </p>
        </div>
      )}
    </div>
  );
} 