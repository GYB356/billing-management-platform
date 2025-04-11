 'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  ArrowPathIcon,
  EyeIcon,
  EyeSlashIcon,
  ChevronUpIcon,
  ChevronDownIcon
} from '@heroicons/react/24/outline';
import { PricingPlan } from '@/lib/types/pricing';

export default function PricingPlansPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [sortField, setSortField] = useState<'name' | 'sortOrder' | 'basePrice'>('sortOrder');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive' | 'public' | 'private'>('all');

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/pricing/plans');
      if (!response.ok) {
        throw new Error('Failed to fetch pricing plans');
      }
      const data = await response.json();
      setPlans(data);
    } catch (error) {
      console.error('Error fetching plans:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (planId: string) => {
    if (!confirm('Are you sure you want to delete this plan? This action cannot be undone.')) {
      return;
    }

    setIsDeleting(true);
    setSelectedPlanId(planId);

    try {
      const response = await fetch(`/api/pricing/plans/${planId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to delete plan');
      }

      // Remove from local state
      setPlans(plans.filter(plan => plan.id !== planId));
    } catch (error) {
      console.error('Error deleting plan:', error);
      alert('Failed to delete plan. Please try again.');
    } finally {
      setIsDeleting(false);
      setSelectedPlanId(null);
    }
  };

  const togglePlanStatus = async (planId: string, currentStatus: boolean) => {
    setSelectedPlanId(planId);

    try {
      const response = await fetch(`/api/pricing/plans/${planId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          isActive: !currentStatus
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update plan status');
      }

      // Update local state
      setPlans(plans.map(plan => 
        plan.id === planId 
          ? { ...plan, isActive: !currentStatus } 
          : plan
      ));
    } catch (error) {
      console.error('Error updating plan status:', error);
      alert('Failed to update plan status. Please try again.');
    } finally {
      setSelectedPlanId(null);
    }
  };

  const handleSort = (field: 'name' | 'sortOrder' | 'basePrice') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const filteredPlans = plans.filter(plan => {
    if (filter === 'all') return true;
    if (filter === 'active') return plan.isActive;
    if (filter === 'inactive') return !plan.isActive;
    if (filter === 'public') return plan.isPublic;
    if (filter === 'private') return !plan.isPublic;
    return true;
  });

  const sortedPlans = [...filteredPlans].sort((a, b) => {
    let valueA, valueB;

    if (sortField === 'name') {
      valueA = a.name.toLowerCase();
      valueB = b.name.toLowerCase();
    } else if (sortField === 'basePrice') {
      valueA = a.basePrice;
      valueB = b.basePrice;
    } else {
      valueA = a.sortOrder;
      valueB = b.sortOrder;
    }

    if (valueA < valueB) return sortDirection === 'asc' ? -1 : 1;
    if (valueA > valueB) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const formatCurrency = (amount: number, currency: string) => {
    const currencySymbol = 
      currency === 'USD' ? '$' :
      currency === 'EUR' ? '€' :
      currency === 'GBP' ? '£' : '$';
    
    return `${currencySymbol}${(amount / 100).toFixed(2)}`;
  };

  const formatPricingType = (type: string) => {
    switch (type) {
      case 'flat':
        return 'Flat Rate';
      case 'per_user':
        return 'Per User';
      case 'tiered':
        return 'Tiered';
      case 'usage_based':
        return 'Usage Based';
      default:
        return type;
    }
  };

  const formatBillingInterval = (interval: string) => {
    switch (interval) {
      case 'monthly':
        return 'Monthly';
      case 'quarterly':
        return 'Quarterly';
      case 'annual':
        return 'Annual';
      case 'custom':
        return 'Custom';
      default:
        return interval;
    }
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-gray-900">Pricing Plans</h1>
          <p className="mt-2 text-sm text-gray-700">
            Manage your subscription plans, pricing tiers, and features.
          </p>
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
          <Link
            href="/admin/pricing/plans/new"
            className="inline-flex items-center justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:w-auto"
          >
            <PlusIcon className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
            New Plan
          </Link>
        </div>
      </div>

      <div className="mt-6 flex flex-col">
        <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
            <div className="mb-4 flex justify-between items-center">
              <div className="flex space-x-2">
                <select
                  className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value as any)}
                >
                  <option value="all">All Plans</option>
                  <option value="active">Active Only</option>
                  <option value="inactive">Inactive Only</option>
                  <option value="public">Public Only</option>
                  <option value="private">Private Only</option>
                </select>
              </div>
              <button
                className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                onClick={fetchPlans}
              >
                <ArrowPathIcon className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
                Refresh
              </button>
            </div>

            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
              <table className="min-w-full divide-y divide-gray-300">
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      scope="col"
                      className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6"
                    >
                      <button
                        className="group inline-flex"
                        onClick={() => handleSort('name')}
                      >
                        Plan Name
                        <span className="ml-2 flex-none rounded text-gray-400">
                          {sortField === 'name' ? (
                            sortDirection === 'asc' ? (
                              <ChevronUpIcon className="h-5 w-5" aria-hidden="true" />
                            ) : (
                              <ChevronDownIcon className="h-5 w-5" aria-hidden="true" />
                            )
                          ) : (
                            <ChevronUpIcon className="invisible h-5 w-5" aria-hidden="true" />
                          )}
                        </span>
                      </button>
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                    >
                      <button
                        className="group inline-flex"
                        onClick={() => handleSort('basePrice')}
                      >
                        Price
                        <span className="ml-2 flex-none rounded text-gray-400">
                          {sortField === 'basePrice' ? (
                            sortDirection === 'asc' ? (
                              <ChevronUpIcon className="h-5 w-5" aria-hidden="true" />
                            ) : (
                              <ChevronDownIcon className="h-5 w-5" aria-hidden="true" />
                            )
                          ) : (
                            <ChevronUpIcon className="invisible h-5 w-5" aria-hidden="true" />
                          )}
                        </span>
                      </button>
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                    >
                      Type
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                    >
                      Billing
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                    >
                      <button
                        className="group inline-flex"
                        onClick={() => handleSort('sortOrder')}
                      >
                        Display Order
                        <span className="ml-2 flex-none rounded text-gray-400">
                          {sortField === 'sortOrder' ? (
                            sortDirection === 'asc' ? (
                              <ChevronUpIcon className="h-5 w-5" aria-hidden="true" />
                            ) : (
                              <ChevronDownIcon className="h-5 w-5" aria-hidden="true" />
                            )
                          ) : (
                            <ChevronUpIcon className="invisible h-5 w-5" aria-hidden="true" />
                          )}
                        </span>
                      </button>
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                    >
                      Status
                    </th>
                    <th
                      scope="col"
                      className="relative py-3.5 pl-3 pr-4 sm:pr-6"
                    >
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {isLoading ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-sm text-gray-500">
                        <div className="flex justify-center">
                          <ArrowPathIcon className="h-6 w-6 animate-spin text-gray-400" />
                        </div>
                        <p className="mt-2">Loading plans...</p>
                      </td>
                    </tr>
                  ) : sortedPlans.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-sm text-gray-500">
                        No pricing plans found.
                      </td>
                    </tr>
                  ) : (
                    sortedPlans.map((plan) => (
                      <tr key={plan.id}>
                        <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                          {plan.name}
                          {!plan.isPublic && (
                            <span className="ml-2 inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800">
                              Private
                            </span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {formatCurrency(plan.basePrice, plan.currency)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {formatPricingType(plan.pricingType)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {formatBillingInterval(plan.billingInterval)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {plan.sortOrder}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          <span
                            className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                              plan.isActive
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {plan.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                          <div className="flex items-center justify-end space-x-4">
                            <button
                              onClick={() => togglePlanStatus(plan.id, plan.isActive)}
                              className={`text-gray-600 hover:text-gray-900 ${
                                selectedPlanId === plan.id ? 'opacity-50' : ''
                              }`}
                              disabled={selectedPlanId === plan.id}
                            >
                              {plan.isActive ? (
                                <EyeSlashIcon className="h-5 w-5" aria-hidden="true" />
                              ) : (
                                <EyeIcon className="h-5 w-5" aria-hidden="true" />
                              )}
                            </button>
                            <Link
                              href={`/admin/pricing/plans/${plan.id}`}
                              className="text-indigo-600 hover:text-indigo-900"
                            >
                              <PencilIcon className="h-5 w-5" aria-hidden="true" />
                            </Link>
                            <button
                              onClick={() => handleDelete(plan.id)}
                              className={`text-red-600 hover:text-red-900 ${
                                isDeleting && selectedPlanId === plan.id ? 'opacity-50' : ''
                              }`}
                              disabled={isDeleting && selectedPlanId === plan.id}
                            >
                              <TrashIcon className="h-5 w-5" aria-hidden="true" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}