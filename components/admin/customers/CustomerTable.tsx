'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpDownIcon,
} from '@heroicons/react/24/outline';

interface Customer {
  id: string;
  name: string;
  email: string;
  stripeCustomerId: string;
  createdAt: Date;
  subscriptions: Array<{
    id: string;
    status: string;
    plan: {
      name: string;
    };
  }>;
}

interface CustomerTableProps {
  customers: Customer[];
  total: number;
  page: number;
  limit: number;
}

export default function CustomerTable({
  customers,
  total,
  page,
  limit,
}: CustomerTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleSort = (field: string) => {
    const params = new URLSearchParams(searchParams.toString());
    const currentSort = searchParams.get('sort') || '';
    const currentOrder = searchParams.get('order') || 'asc';

    if (currentSort === field) {
      params.set('order', currentOrder === 'asc' ? 'desc' : 'asc');
    } else {
      params.set('sort', field);
      params.set('order', 'asc');
    }

    router.push(`/admin/customers?${params.toString()}`);
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', newPage.toString());
    router.push(`/admin/customers?${params.toString()}`);
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="overflow-hidden">
      <table className="min-w-full divide-y divide-gray-300">
        <thead className="bg-gray-50">
          <tr>
            <th
              scope="col"
              className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6"
            >
              <button
                onClick={() => handleSort('name')}
                className="group inline-flex"
              >
                Name
                <span className="ml-2 flex-none rounded text-gray-400">
                  <ChevronUpDownIcon className="h-5 w-5" aria-hidden="true" />
                </span>
              </button>
            </th>
            <th
              scope="col"
              className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
            >
              <button
                onClick={() => handleSort('email')}
                className="group inline-flex"
              >
                Email
                <span className="ml-2 flex-none rounded text-gray-400">
                  <ChevronUpDownIcon className="h-5 w-5" aria-hidden="true" />
                </span>
              </button>
            </th>
            <th
              scope="col"
              className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
            >
              <button
                onClick={() => handleSort('stripeCustomerId')}
                className="group inline-flex"
              >
                Stripe ID
                <span className="ml-2 flex-none rounded text-gray-400">
                  <ChevronUpDownIcon className="h-5 w-5" aria-hidden="true" />
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
              className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
            >
              <button
                onClick={() => handleSort('createdAt')}
                className="group inline-flex"
              >
                Created
                <span className="ml-2 flex-none rounded text-gray-400">
                  <ChevronUpDownIcon className="h-5 w-5" aria-hidden="true" />
                </span>
              </button>
            </th>
            <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {customers.map((customer) => (
            <tr key={customer.id}>
              <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                {customer.name}
              </td>
              <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                {customer.email}
              </td>
              <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                {customer.stripeCustomerId}
              </td>
              <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                {customer.subscriptions[0]?.status || 'No subscription'}
              </td>
              <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                {new Date(customer.createdAt).toLocaleDateString()}
              </td>
              <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                <Link
                  href={`/admin/customers/${customer.id}`}
                  className="text-indigo-600 hover:text-indigo-900"
                >
                  View
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6">
        <div className="flex flex-1 justify-between sm:hidden">
          <button
            onClick={() => handlePageChange(page - 1)}
            disabled={page === 1}
            className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Previous
          </button>
          <button
            onClick={() => handlePageChange(page + 1)}
            disabled={page === totalPages}
            className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Next
          </button>
        </div>
        <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-gray-700">
              Showing <span className="font-medium">{(page - 1) * limit + 1}</span> to{' '}
              <span className="font-medium">
                {Math.min(page * limit, total)}
              </span>{' '}
              of <span className="font-medium">{total}</span> results
            </p>
          </div>
          <div>
            <nav
              className="isolate inline-flex -space-x-px rounded-md shadow-sm"
              aria-label="Pagination"
            >
              <button
                onClick={() => handlePageChange(page - 1)}
                disabled={page === 1}
                className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
              >
                <span className="sr-only">Previous</span>
                <ChevronLeftIcon className="h-5 w-5" aria-hidden="true" />
              </button>
              <button
                onClick={() => handlePageChange(page + 1)}
                disabled={page === totalPages}
                className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
              >
                <span className="sr-only">Next</span>
                <ChevronRightIcon className="h-5 w-5" aria-hidden="true" />
              </button>
            </nav>
          </div>
        </div>
      </div>
    </div>
  );
}