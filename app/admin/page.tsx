import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';
import RevenueChart from '@/components/admin/RevenueChart';
import SubscriptionMetrics from '@/components/admin/SubscriptionMetrics';
import CustomerMetrics from '@/components/admin/CustomerMetrics';

async function getRevenueData() {
  // Get revenue data from Stripe
  const balance = await stripe.balance.retrieve();
  const transactions = await stripe.balanceTransactions.list({
    limit: 100,
  });

  return {
    balance,
    transactions: transactions.data,
  };
}

async function getSubscriptionMetrics() {
  const subscriptions = await prisma.subscription.findMany({
    include: {
      plan: true,
    },
  });

  const metrics = {
    total: subscriptions.length,
    active: subscriptions.filter(s => s.status === 'ACTIVE').length,
    trialing: subscriptions.filter(s => s.status === 'TRIALING').length,
    canceled: subscriptions.filter(s => s.status === 'CANCELED').length,
    byPlan: subscriptions.reduce((acc, sub) => {
      acc[sub.plan.name] = (acc[sub.plan.name] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
  };

  return metrics;
}

async function getCustomerMetrics() {
  const customers = await prisma.organization.findMany({
    include: {
      subscriptions: true,
    },
  });

  const metrics = {
    total: customers.length,
    withActiveSubscription: customers.filter(c => 
      c.subscriptions.some(s => s.status === 'ACTIVE')
    ).length,
    withTrial: customers.filter(c => 
      c.subscriptions.some(s => s.status === 'TRIALING')
    ).length,
    churnRate: 0, // Calculate based on historical data
  };

  return metrics;
}

export default async function AdminDashboard() {
  const [revenueData, subscriptionMetrics, customerMetrics] = await Promise.all([
    getRevenueData(),
    getSubscriptionMetrics(),
    getCustomerMetrics(),
  ]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total Revenue</dt>
                  <dd className="text-lg font-medium text-gray-900">
                    ${(revenueData.balance.available[0].amount / 100).toFixed(2)}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Active Subscriptions</dt>
                  <dd className="text-lg font-medium text-gray-900">{subscriptionMetrics.active}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total Customers</dt>
                  <dd className="text-lg font-medium text-gray-900">{customerMetrics.total}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Trial Conversions</dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {subscriptionMetrics.trialing > 0
                      ? `${((subscriptionMetrics.active / subscriptionMetrics.trialing) * 100).toFixed(1)}%`
                      : '0%'}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Revenue Overview</h3>
          <RevenueChart transactions={revenueData.transactions} />
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Subscription Distribution</h3>
          <SubscriptionMetrics metrics={subscriptionMetrics} />
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Customer Metrics</h3>
        <CustomerMetrics metrics={customerMetrics} />
      </div>
    </div>
  );
} 