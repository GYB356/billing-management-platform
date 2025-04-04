'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  PencilIcon,
  TrashIcon,
  ArrowPathIcon,
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
      price: number;
    };
    currentPeriodEnd: Date;
  }>;
}

interface CustomerDetailsProps {
  customer: Customer;
}

export default function CustomerDetails({ customer }: CustomerDetailsProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleEdit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    const email = formData.get('email') as string;

    try {
      const response = await fetch(`/api/admin/customers/${customer.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, email }),
      });

      if (!response.ok) {
        throw new Error('Failed to update customer');
      }

      setIsEditing(false);
      router.refresh();
    } catch (error) {
      console.error('Error updating customer:', error);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this customer?')) {
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/admin/customers/${customer.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete customer');
      }

      router.push('/admin/customers');
    } catch (error) {
      console.error('Error deleting customer:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRefreshSubscription = async () => {
    try {
      const response = await fetch(
        `/api/admin/customers/${customer.id}/refresh-subscription`,
        {
          method: 'POST',
        }
      );

      if (!response.ok) {
        throw new Error('Failed to refresh subscription');
      }

      router.refresh();
    } catch (error) {
      console.error('Error refreshing subscription:', error);
    }
  };

  return (
    <div className="bg-white shadow sm:rounded-lg">
      <div className="px-4 py-5 sm:p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium leading-6 text-gray-900">
            Customer Information
          </h3>
          <div className="flex space-x-3">
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium leading-4 text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              <PencilIcon className="h-4 w-4 mr-2" />
              {isEditing ? 'Cancel' : 'Edit'}
            </button>
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="inline-flex items-center rounded-md border border-red-300 bg-white px-3 py-2 text-sm font-medium leading-4 text-red-700 shadow-sm hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50"
            >
              <TrashIcon className="h-4 w-4 mr-2" />
              Delete
            </button>
          </div>
        </div>

        {isEditing ? (
          <form onSubmit={handleEdit} className="mt-5 space-y-4">
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium text-gray-700"
              >
                Name
              </label>
              <input
                type="text"
                name="name"
                id="name"
                defaultValue={customer.name}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700"
              >
                Email
              </label>
              <input
                type="email"
                name="email"
                id="email"
                defaultValue={customer.email}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                className="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                Save Changes
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-5 space-y-4">
            <div>
              <h4 className="text-sm font-medium text-gray-500">Name</h4>
              <p className="mt-1 text-sm text-gray-900">{customer.name}</p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-500">Email</h4>
              <p className="mt-1 text-sm text-gray-900">{customer.email}</p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-500">
                Stripe Customer ID
              </h4>
              <p className="mt-1 text-sm text-gray-900">
                {customer.stripeCustomerId}
              </p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-500">Created At</h4>
              <p className="mt-1 text-sm text-gray-900">
                {new Date(customer.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-gray-200 px-4 py-5 sm:p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium leading-6 text-gray-900">
            Subscription Information
          </h3>
          <button
            onClick={handleRefreshSubscription}
            className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium leading-4 text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            <ArrowPathIcon className="h-4 w-4 mr-2" />
            Refresh
          </button>
        </div>

        <div className="mt-5 space-y-4">
          {customer.subscriptions.map((subscription) => (
            <div key={subscription.id} className="space-y-2">
              <div>
                <h4 className="text-sm font-medium text-gray-500">Status</h4>
                <p className="mt-1 text-sm text-gray-900">{subscription.status}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-500">Plan</h4>
                <p className="mt-1 text-sm text-gray-900">
                  {subscription.plan.name}
                </p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-500">Price</h4>
                <p className="mt-1 text-sm text-gray-900">
                  ${subscription.plan.price / 100}/month
                </p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-500">
                  Current Period End
                </h4>
                <p className="mt-1 text-sm text-gray-900">
                  {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}