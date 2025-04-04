 

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/outline';

interface Subscription {
  id: string;
  customer: {
    name: string;
    email: string;
  };
  plan: {
    name: string;
    price: number;
  };
  status: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  trialEnd: Date | null;
}

interface SubscriptionTableProps {
  subscriptions: Subscription[];
  totalCount: number;
  currentPage: number;
  pageSize: number;
}

type SortField = 'customer' | 'plan' | 'status' | 'periodStart' | 'periodEnd';
type SortDirection = 'asc' | 'desc';

export default function SubscriptionTable({
  subscriptions,
  totalCount,
  currentPage,
  pageSize,
}: SubscriptionTableProps) {
  const router = useRouter();
  const [sortField, setSortField] = useState<SortField>('periodStart');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(window.location.search);
    params.set('page', page.toString());
    router.push(`/admin/subscriptions?${params.toString()}`);
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="mt-8 flow-root">
      <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
        <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
          <table className="min-w-full divide-y divide-gray-300">
            <thead>
              <tr>
                <th
                  scope="col"
                  className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-0"
                >
                  <button
                    onClick={() => handleSort('customer')}
                    className="group inline-flex"
                  >
                    Customer
                    <span className="ml-2 flex-none rounded text-gray-400">
                      {sortField === 'customer' ? (
                        sortDirection === 'asc' ? (
                          <ChevronUpIcon className="h-5 w-5" aria-hidden="true" />
                        ) : (
                          <ChevronDownIcon className="h-5 w-5" aria-hidden="true" />
                        )
                      ) : (
                        <ChevronUpIcon className="h-5 w-5" aria-hidden="true" />
                      )}
                    </span>
                  </button>
                </th>
                <th
                  scope="col"
                  className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                >
                  <button
                    onClick={() => handleSort('plan')}
                    className="group inline-flex"
                  >
                    Plan
                    <span className="ml-2 flex-none rounded text-gray-400">
                      {sortField === 'plan' ? (
                        sortDirection === 'asc' ? (
                          <ChevronUpIcon className="h-5 w-5" aria-hidden="true" />
                        ) : (
                          <ChevronDownIcon className="h-5 w-5" aria-hidden="true" />
                        )
                      ) : (
                        <ChevronUpIcon className="h-5 w-5" aria-hidden="true" />
                      )}
                    </span>
                  </button>
                </th>
                <th
                  scope="col"
                  className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                >
                  <button
                    onClick={() => handleSort('status')}
                    className="group inline-flex"
                  >
                    Status
                    <span className="ml-2 flex-none rounded text-gray-400">
                      {sortField === 'status' ? (
                        sortDirection === 'asc' ? (
                          <ChevronUpIcon className="h-5 w-5" aria-hidden="true" />
                        ) : (
                          <ChevronDownIcon className="h-5 w-5" aria-hidden="true" />
                        )
                      ) : (
                        <ChevronUpIcon className="h-5 w-5" aria-hidden="true" />
                      )}
                    </span>
                  </button>
                </th>
                <th
                  scope="col"
                  className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                >
                  <button
                    onClick={() => handleSort('periodStart')}
                    className="group inline-flex"
                  >
                    Period Start
                    <span className="ml-2 flex-none rounded text-gray-400">
                      {sortField === 'periodStart' ? (
                        sortDirection === 'asc' ? (
                          <ChevronUpIcon className="h-5 w-5" aria-hidden="true" />
                        ) : (
                          <ChevronDownIcon className="h-5 w-5" aria-hidden="true" />
                        )
                      ) : (
                        <ChevronUpIcon className="h-5 w-5" aria-hidden="true" />
                      )}
                    </span>
                  </button>
                </th>
                <th
                  scope="col"
                  className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                >
                  <button
                    onClick={() => handleSort('periodEnd')}
                    className="group inline-flex"
                  >
                    Period End
                    <span className="ml-2 flex-none rounded text-gray-400">
                      {sortField === 'periodEnd' ? (
                        sortDirection === 'asc' ? (
                          <ChevronUpIcon className="h-5 w-5" aria-hidden="true" />
                        ) : (
                          <ChevronDownIcon className="h-5 w-5" aria-hidden="true" />
                        )
                      ) : (
                        <ChevronUpIcon className="h-5 w-5" aria-hidden="true" />
                      )}
                    </span>
                  </button>
                </th>
                <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-0">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {subscriptions.map((subscription) => (
                <tr key={subscription.id}>
                  <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-0">
                    <div>
                      <div>{subscription.customer.name}</div>
                      <div className="text-gray-500">{subscription.customer.email}</div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                    <div>
                      <div>{subscription.plan.name}</div>
                      <div>${subscription.plan.price / 100}/month</div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                    <span
                      className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
                        subscription.status === 'ACTIVE'
                          ? 'bg-green-100 text-green-800'
                          : subscription.status === 'TRIALING'
                          ? 'bg-blue-100 text-blue-800'
                          : subscription.status === 'CANCELED'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {subscription.status}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                    {format(new Date(subscription.currentPeriodStart), 'MMM d, yyyy')}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                    {format(new Date(subscription.currentPeriodEnd), 'MMM d, yyyy')}
                  </td>
                  <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-0">
                    <button
                      onClick={() => router.push(`/admin/subscriptions/${subscription.id}`)}
                      className="text-indigo-600 hover:text-indigo-900"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="mt-4 flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6">
        <div className="flex flex-1 justify-between sm:hidden">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Previous
          </button>
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Next
          </button>
        </div>
        <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-gray-700">
              Showing <span className="font-medium">{(currentPage - 1) * pageSize + 1}</span> to{' '}
              <span className="font-medium">
                {Math.min(currentPage * pageSize, totalCount)}
              </span>{' '}
              of <span className="font-medium">{totalCount}</span> results
            </p>
          </div>
          <div>
            <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
              >
                <span className="sr-only">Previous</span>
                <ChevronUpIcon className="h-5 w-5" aria-hidden="true" />
              </button>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
              >
                <span className="sr-only">Next</span>
                <ChevronDownIcon className="h-5 w-5" aria-hidden="true" />
              </button>
            </nav>
          </div>
        </div>
      </div>
    </div>
  );
}