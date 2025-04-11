'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  ChartBarIcon, 
  ArrowPathIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  UserIcon,
  CurrencyDollarIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import Link from 'next/link';

interface CustomerUsageMonitorProps {
  initialCustomerId?: string;
}

export default function CustomerUsageMonitor({ initialCustomerId }: CustomerUsageMonitorProps) {
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | undefined>(initialCustomerId);
  const [selectedFeature, setSelectedFeature] = useState<string | 'all'>('all');
  const [timeRange, setTimeRange] = useState<'7days' | '30days' | 'billing'>('billing');
  const [sortBy, setSortBy] = useState<'usage' | 'name' | 'cost'>('usage');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [expandedCustomers, setExpandedCustomers] = useState<Record<string, boolean>>({});

  // Fetch customers with active subscriptions
  const { data: customers, isLoading: customersLoading } = useQuery({
    queryKey: ['customers-with-subscriptions'],
    queryFn: async () => {
      const response = await fetch('/api/admin/customers?hasActiveSubscription=true');
      if (!response.ok) throw new Error('Failed to fetch customers');
      return response.json();
    },
  });

  // Fetch features that have usage-based billing
  const { data: features, isLoading: featuresLoading } = useQuery({
    queryKey: ['usage-features'],
    queryFn: async () => {
      const response = await fetch('/api/admin/features?type=usage');
      if (!response.ok) throw new Error('Failed to fetch features');
      return response.json();
    },
  });

  // Fetch usage data for selected customer or all customers
  const { data: usageData, isLoading: usageLoading, refetch } = useQuery({
    queryKey: ['customer-usage', selectedCustomerId, selectedFeature, timeRange],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedCustomerId) params.append('customerId', selectedCustomerId);
      if (selectedFeature !== 'all') params.append('featureId', selectedFeature);
      params.append('timeRange', timeRange);

      const response = await fetch(`/api/admin/usage?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch usage data');
      return response.json();
    },
  });

  const toggleCustomerExpanded = (customerId: string) => {
    setExpandedCustomers(prev => ({
      ...prev,
      [customerId]: !prev[customerId],
    }));
  };

  const handleRefresh = () => {
    refetch();
  };

  const handleSort = (field: 'usage' | 'name' | 'cost') => {
    if (sortBy === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDirection('desc');
    }
  };

  const isLoading = customersLoading || featuresLoading || usageLoading;

  // Process and sort usage data
  const processedData = usageData?.customers || [];
  
  const sortedData = [...processedData].sort((a, b) => {
    if (sortBy === 'name') {
      return sortDirection === 'asc'
        ? a.name.localeCompare(b.name)
        : b.name.localeCompare(a.name);
    } else if (sortBy === 'cost') {
      return sortDirection === 'asc'
        ? a.estimatedCost - b.estimatedCost
        : b.estimatedCost - a.estimatedCost;
    } else { // usage
      const aUsage = a.totalUsage || 0;
      const bUsage = b.totalUsage || 0;
      return sortDirection === 'asc' ? aUsage - bUsage : bUsage - aUsage;
    }
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount / 100);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  return (
    <div className="space-y-8">
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-medium leading-6 text-gray-900">Customer Usage Monitor</h3>
          <p className="mt-1 text-sm text-gray-500">
            Track and analyze usage-based billing across customers
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <button
            type="button"
            onClick={handleRefresh}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <ArrowPathIcon className="-ml-1 mr-2 h-5 w-5 text-gray-500" aria-hidden="true" />
            Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <label htmlFor="customer-select" className="block text-sm font-medium text-gray-700">
              Customer
            </label>
            <select
              id="customer-select"
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
              value={selectedCustomerId || ''}
              onChange={(e) => setSelectedCustomerId(e.target.value || undefined)}
              disabled={isLoading}
            >
              <option value="">All Customers</option>
              {customers?.map((customer: any) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="feature-select" className="block text-sm font-medium text-gray-700">
              Feature
            </label>
            <select
              id="feature-select"
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
              value={selectedFeature}
              onChange={(e) => setSelectedFeature(e.target.value)}
              disabled={isLoading}
            >
              <option value="all">All Features</option>
              {features?.map((feature: any) => (
                <option key={feature.id} value={feature.id}>
                  {feature.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="time-range" className="block text-sm font-medium text-gray-700">
              Time Range
            </label>
            <select
              id="time-range"
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as any)}
              disabled={isLoading}
            >
              <option value="7days">Last 7 Days</option>
              <option value="30days">Last 30 Days</option>
              <option value="billing">Current Billing Period</option>
            </select>
          </div>

          <div>
            <label htmlFor="sort-by" className="block text-sm font-medium text-gray-700">
              Sort By
            </label>
            <select
              id="sort-by"
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
              value={`${sortBy}-${sortDirection}`}
              onChange={(e) => {
                const [field, direction] = e.target.value.split('-');
                setSortBy(field as any);
                setSortDirection(direction as any);
              }}
              disabled={isLoading}
            >
              <option value="usage-desc">Highest Usage</option>
              <option value="usage-asc">Lowest Usage</option>
              <option value="cost-desc">Highest Cost</option>
              <option value="cost-asc">Lowest Cost</option>
              <option value="name-asc">Customer Name (A-Z)</option>
              <option value="name-desc">Customer Name (Z-A)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      {usageData && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <ChartBarIcon className="h-6 w-6 text-gray-400" aria-hidden="true" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Total Usage</dt>
                    <dd className="text-lg font-semibold text-gray-900">{formatNumber(usageData.totalUsage)}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <UserIcon className="h-6 w-6 text-gray-400" aria-hidden="true" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Active Customers</dt>
                    <dd className="text-lg font-semibold text-gray-900">{usageData.activeCustomers}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <CurrencyDollarIcon className="h-6 w-6 text-gray-400" aria-hidden="true" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Estimated Revenue</dt>
                    <dd className="text-lg font-semibold text-gray-900">{formatCurrency(usageData.totalEstimatedCost)}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Usage table */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Customer Usage</h3>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
          </div>
        ) : sortedData.length === 0 ? (
          <div className="text-center py-12">
            <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No usage data found</h3>
            <p className="mt-1 text-sm text-gray-500">
              No customers have recorded usage for the selected criteria.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center">
                      Customer
                      {sortBy === 'name' && (
                        <span className="ml-1">
                          {sortDirection === 'asc' ? (
                            <ChevronUpIcon className="h-4 w-4" />
                          ) : (
                            <ChevronDownIcon className="h-4 w-4" />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                    onClick={() => handleSort('usage')}
                  >
                    <div className="flex items-center">
                      Usage
                      {sortBy === 'usage' && (
                        <span className="ml-1">
                          {sortDirection === 'asc' ? (
                            <ChevronUpIcon className="h-4 w-4" />
                          ) : (
                            <ChevronDownIcon className="h-4 w-4" />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                    onClick={() => handleSort('cost')}
                  >
                    <div className="flex items-center">
                      Est. Cost
                      {sortBy === 'cost' && (
                        <span className="ml-1">
                          {sortDirection === 'asc' ? (
                            <ChevronUpIcon className="h-4 w-4" />
                          ) : (
                            <ChevronDownIcon className="h-4 w-4" />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Details
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sortedData.map((customer: any) => (
                  <React.Fragment key={customer.id}>
                    <tr className={expandedCustomers[customer.id] ? 'bg-gray-50' : 'hover:bg-gray-50'}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                              <span className="text-gray-500 font-medium">{customer.name.charAt(0)}</span>
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{customer.name}</div>
                            <div className="text-sm text-gray-500">{customer.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{formatNumber(customer.totalUsage || 0)}</div>
                        <div className="text-sm text-gray-500">
                          {selectedFeature === 'all' ? 'across all features' : 'units'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {formatCurrency(customer.estimatedCost || 0)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => toggleCustomerExpanded(customer.id)}
                          className="text-indigo-600 hover:text-indigo-900 mr-4"
                        >
                          {expandedCustomers[customer.id] ? 'Hide Details' : 'Show Details'}
                        </button>
                        <Link
                          href={`/admin/customers/${customer.id}`}
                          className="text-indigo-600 hover:text-indigo-900"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                    {expandedCustomers[customer.id] && (
                      <tr>
                        <td colSpan={4} className="px-6 py-4 bg-gray-50">
                          <div className="space-y-4">
                            <h4 className="text-sm font-medium text-gray-900">Feature Breakdown</h4>
                            {customer.features.length === 0 ? (
                              <p className="text-sm text-gray-500">No feature usage data available.</p>
                            ) : (
                              <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                  <thead className="bg-gray-100">
                                    <tr>
                                      <th
                                        scope="col"
                                        className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                                      >
                                        Feature
                                      </th>
                                      <th
                                        scope="col"
                                        className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                                      >
                                        Usage
                                      </th>
                                      <th
                                        scope="col"
                                        className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                                      >
                                        Current Tier
                                      </th>
                                      <th
                                        scope="col"
                                        className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                                      >
                                        Est. Cost
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody className="bg-white divide-y divide-gray-200">
                                    {customer.features.map((feature: any) => (
                                      <tr key={feature.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                                          {feature.name}
                                        </td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                                          <div className="flex items-center">
                                            <span>{formatNumber(feature.usage)}</span>
                                            <span className="ml-1 text-xs text-gray-500">
                                              {feature.unitName || 'units'}
                                            </span>
                                          </div>
                                          
                                          {/* Progress bar */}
                                          {feature.usageLimit > 0 && (
                                            <div className="w-full mt-1">
                                              <div className="overflow-hidden h-2 text-xs flex rounded bg-gray-200">
                                                <div
                                                  style={{ width: `${Math.min((feature.usage / feature.usageLimit) * 100, 100)}%` }}
                                                  className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center
                                                    ${(feature.usage / feature.usageLimit) > 0.9 ? 'bg-red-500' : 
                                                      (feature.usage / feature.usageLimit) > 0.75 ? 'bg-yellow-500' : 'bg-green-500'}`}
                                                ></div>
                                              </div>
                                            </div>
                                          )}
                                        </td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                                          {feature.currentTier?.name || '-'}
                                        </td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                                          {formatCurrency(feature.cost || 0)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
} 