<<<<<<< HEAD
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { WithPermission } from '@/components/auth/with-permission';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';
import RevenueChart from '@/components/admin/RevenueChart';
import SubscriptionMetrics from '@/components/admin/SubscriptionMetrics';
import CustomerMetrics from '@/components/admin/CustomerMetrics';
=======
'use client';
>>>>>>> 58d4a3da7158e64e5700c51b28776197a8d974c9

import React from 'react';

<<<<<<< HEAD
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
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/auth/signin');
  }

  const stats = await prisma.$transaction([
    prisma.user.count(),
    prisma.organization.count(),
    prisma.subscription.count(),
  ]);

  const [revenueData, subscriptionMetrics, customerMetrics] = await Promise.all([
    getRevenueData(),
    getSubscriptionMetrics(),
    getCustomerMetrics(),
  ]);

  return (
    <WithPermission permission="admin.access">
      <div className="container mx-auto py-6">
        <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>
        
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Total Users</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stats[0]}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Organizations</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stats[1]}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Active Subscriptions</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stats[2]}</p>
            </CardContent>
          </Card>
        </div>

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
      </div>
    </WithPermission>
=======
export default function AdminDashboard() {
  console.log('Admin dashboard rendered'); // Debugging log

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow mb-6">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-2xl font-semibold mb-4">Welcome, Admin!</h2>
          <p className="text-gray-600">
            Use this dashboard to manage users, subscriptions, and billing details.
          </p>

          {/* Example Cards */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-indigo-100 p-4 rounded-lg shadow">
              <h3 className="text-lg font-medium text-indigo-700">Manage Users</h3>
              <p className="text-sm text-indigo-600">View and manage user accounts.</p>
              <button className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
                View Users
              </button>
            </div>
            <div className="bg-green-100 p-4 rounded-lg shadow">
              <h3 className="text-lg font-medium text-green-700">Subscriptions</h3>
              <p className="text-sm text-green-600">Track and manage subscriptions.</p>
              <button className="mt-4 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">
                View Subscriptions
              </button>
            </div>
            <div className="bg-yellow-100 p-4 rounded-lg shadow">
              <h3 className="text-lg font-medium text-yellow-700">Billing</h3>
              <p className="text-sm text-yellow-600">View and process invoices.</p>
              <button className="mt-4 px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700">
                View Billing
              </button>
            </div>
          </div>

          {/* Analytics Section */}
          <div className="mt-10 bg-gray-50 p-6 rounded-lg shadow">
            <h3 className="text-xl font-semibold text-gray-900">Analytics Overview</h3>
            <p className="text-sm text-gray-600 mt-2">
              Get insights into your platform's performance.
            </p>
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white p-4 rounded-lg shadow">
                <h4 className="text-lg font-medium text-gray-900">Total Users</h4>
                <p className="text-2xl font-bold text-indigo-600 mt-2">1,234</p>
              </div>
              <div className="bg-white p-4 rounded-lg shadow">
                <h4 className="text-lg font-medium text-gray-900">Active Subscriptions</h4>
                <p className="text-2xl font-bold text-green-600 mt-2">567</p>
              </div>
              <div className="bg-white p-4 rounded-lg shadow">
                <h4 className="text-lg font-medium text-gray-900">Monthly Revenue</h4>
                <p className="text-2xl font-bold text-yellow-600 mt-2">$12,345</p>
              </div>
              <div className="bg-white p-4 rounded-lg shadow">
                <h4 className="text-lg font-medium text-gray-900">Pending Invoices</h4>
                <p className="text-2xl font-bold text-red-600 mt-2">23</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
>>>>>>> 58d4a3da7158e64e5700c51b28776197a8d974c9
  );
}