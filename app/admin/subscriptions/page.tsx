'use client';

import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import SubscriptionAnalytics from '@/components/admin/subscriptions/SubscriptionAnalytics';
import SubscriptionFilters from '@/components/admin/subscriptions/SubscriptionFilters';
import SubscriptionTable from '@/components/admin/subscriptions/SubscriptionTable';

async function getSubscriptions(searchParams: URLSearchParams) {
  const response = await fetch(`/api/admin/subscriptions?${searchParams.toString()}`);
  if (!response.ok) {
    throw new Error('Failed to fetch subscriptions');
  }
  return response.json();
}

export default function SubscriptionsPage() {
  const searchParams = useSearchParams();
  const currentPage = Number(searchParams.get('page')) || 1;
  const pageSize = 10;

  const { data, isLoading, error } = useQuery({
    queryKey: ['subscriptions', searchParams.toString()],
    queryFn: () => getSubscriptions(searchParams),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-600">Failed to load subscriptions</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-gray-900">Subscriptions</h1>
          <p className="mt-2 text-sm text-gray-700">
            A list of all subscriptions in your account including their status and
            billing information.
          </p>
        </div>
      </div>

      <SubscriptionAnalytics />

      <div className="flex items-center justify-between">
        <SubscriptionFilters />
      </div>

      <SubscriptionTable
        subscriptions={data?.subscriptions || []}
        totalCount={data?.totalCount || 0}
        currentPage={currentPage}
        pageSize={pageSize}
      />
    </div>
  );
}