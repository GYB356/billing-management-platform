'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Fragment } from 'react';
import { Menu, Transition } from '@headlessui/react';
import { ChevronDownIcon, FunnelIcon } from '@heroicons/react/24/outline';
import { useQuery } from '@tanstack/react-query';

const statuses = [
  { name: 'All', value: '' },
  { name: 'Active', value: 'ACTIVE' },
  { name: 'Trialing', value: 'TRIALING' },
  { name: 'Canceled', value: 'CANCELED' },
  { name: 'Past Due', value: 'PAST_DUE' },
];

async function getPlans() {
  const response = await fetch('/api/admin/plans');
  if (!response.ok) {
    throw new Error('Failed to fetch plans');
  }
  return response.json();
}

export default function SubscriptionFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: plans = [] } = useQuery({
    queryKey: ['plans'],
    queryFn: getPlans,
  });

  const currentStatus = searchParams.get('status') || '';
  const currentPlan = searchParams.get('plan') || '';

  const handleStatusChange = (status: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (status) {
      params.set('status', status);
    } else {
      params.delete('status');
    }
    params.set('page', '1');
    router.push(`/admin/subscriptions?${params.toString()}`);
  };

  const handlePlanChange = (planId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (planId) {
      params.set('plan', planId);
    } else {
      params.delete('plan');
    }
    params.set('page', '1');
    router.push(`/admin/subscriptions?${params.toString()}`);
  };

  return (
    <div className="flex items-center space-x-4">
      <Menu as="div" className="relative inline-block text-left">
        <div>
          <Menu.Button className="inline-flex items-center gap-x-1.5 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50">
            <FunnelIcon className="-ml-0.5 h-5 w-5 text-gray-400" aria-hidden="true" />
            Status
            <ChevronDownIcon className="-mr-1 h-5 w-5 text-gray-400" aria-hidden="true" />
          </Menu.Button>
        </div>

        <Transition
          as={Fragment}
          enter="transition ease-out duration-100"
          enterFrom="transform opacity-0 scale-95"
          enterTo="transform opacity-100 scale-100"
          leave="transition ease-in duration-75"
          leaveFrom="transform opacity-100 scale-100"
          leaveTo="transform opacity-0 scale-95"
        >
          <Menu.Items className="absolute left-0 z-10 mt-2 w-56 origin-top-left rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
            <div className="py-1">
              <div className="px-4 py-2 text-sm font-medium text-gray-700">Status</div>
              {statuses.map((status) => (
                <Menu.Item key={status.value}>
                  {({ active }) => (
                    <button
                      onClick={() => handleStatusChange(status.value)}
                      className={`${
                        active ? 'bg-gray-100 text-gray-900' : 'text-gray-700'
                      } ${
                        currentStatus === status.value ? 'bg-gray-50 text-indigo-600' : ''
                      } block w-full px-4 py-2 text-left text-sm`}
                    >
                      {status.name}
                    </button>
                  )}
                </Menu.Item>
              ))}
            </div>
          </Menu.Items>
        </Transition>
      </Menu>

      <Menu as="div" className="relative inline-block text-left">
        <div>
          <Menu.Button className="inline-flex items-center gap-x-1.5 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50">
            <FunnelIcon className="-ml-0.5 h-5 w-5 text-gray-400" aria-hidden="true" />
            Plan
            <ChevronDownIcon className="-mr-1 h-5 w-5 text-gray-400" aria-hidden="true" />
          </Menu.Button>
        </div>

        <Transition
          as={Fragment}
          enter="transition ease-out duration-100"
          enterFrom="transform opacity-0 scale-95"
          enterTo="transform opacity-100 scale-100"
          leave="transition ease-in duration-75"
          leaveFrom="transform opacity-100 scale-100"
          leaveTo="transform opacity-0 scale-95"
        >
          <Menu.Items className="absolute left-0 z-10 mt-2 w-56 origin-top-left rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
            <div className="py-1">
              <div className="px-4 py-2 text-sm font-medium text-gray-700">Plan</div>
              <Menu.Item>
                {({ active }) => (
                  <button
                    onClick={() => handlePlanChange('')}
                    className={`${
                      active ? 'bg-gray-100 text-gray-900' : 'text-gray-700'
                    } ${
                      !currentPlan ? 'bg-gray-50 text-indigo-600' : ''
                    } block w-full px-4 py-2 text-left text-sm`}
                  >
                    All Plans
                  </button>
                )}
              </Menu.Item>
              {plans.map((plan: { id: string; name: string }) => (
                <Menu.Item key={plan.id}>
                  {({ active }) => (
                    <button
                      onClick={() => handlePlanChange(plan.id)}
                      className={`${
                        active ? 'bg-gray-100 text-gray-900' : 'text-gray-700'
                      } ${
                        currentPlan === plan.id ? 'bg-gray-50 text-indigo-600' : ''
                      } block w-full px-4 py-2 text-left text-sm`}
                    >
                      {plan.name}
                    </button>
                  )}
                </Menu.Item>
              ))}
            </div>
          </Menu.Items>
        </Transition>
      </Menu>

      {(currentStatus || currentPlan) && (
        <button
          onClick={() => {
            const params = new URLSearchParams(searchParams.toString());
            params.delete('status');
            params.delete('plan');
            params.set('page', '1');
            router.push(`/admin/subscriptions?${params.toString()}`);
          }}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Clear filters
        </button>
      )}
    </div>
  );
} 