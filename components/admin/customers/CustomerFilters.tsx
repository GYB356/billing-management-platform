'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Fragment } from 'react';
import { Menu, Transition } from '@headlessui/react';
import { ChevronDownIcon, FunnelIcon } from '@heroicons/react/24/outline';

const statuses = [
  { name: 'All', value: '' },
  { name: 'Active', value: 'ACTIVE' },
  { name: 'Trialing', value: 'TRIALING' },
  { name: 'Canceled', value: 'CANCELED' },
  { name: 'Past Due', value: 'PAST_DUE' },
];

export default function CustomerFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentStatus = searchParams.get('status') || '';

  const handleStatusChange = (status: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (status) {
      params.set('status', status);
    } else {
      params.delete('status');
    }
    params.set('page', '1');
    router.push(`/admin/customers?${params.toString()}`);
  };

  return (
    <div className="flex items-center space-x-4">
      <Menu as="div" className="relative inline-block text-left">
        <div>
          <Menu.Button className="inline-flex items-center gap-x-1.5 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50">
            <FunnelIcon className="-ml-0.5 h-5 w-5 text-gray-400" aria-hidden="true" />
            Filters
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

      {currentStatus && (
        <button
          onClick={() => handleStatusChange('')}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Clear filters
        </button>
      )}
    </div>
  );
} 