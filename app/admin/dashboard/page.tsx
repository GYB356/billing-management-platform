'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Analytics } from './components/Analytics';
import { SubscriptionsList } from './components/SubscriptionsList';
import { CustomersList } from './components/CustomersList';
import { RevenueChart } from './components/RevenueChart';
import { MetricsCards } from './components/MetricsCards';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Alert } from '@/components/ui/Alert';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('overview');

  const { data: analyticsData, isLoading: isAnalyticsLoading, error: analyticsError } = useQuery(
    ['analyticsData'],
    () => fetch('/api/admin/analytics/dashboard').then((res) => res.json())
  );

  const { data: subscriptionData, isLoading: isSubscriptionsLoading, error: subscriptionsError } = useQuery(
    ['subscriptionData'],
    () => fetch('/api/admin/subscriptions/metrics').then((res) => res.json())
  );

  const { data: customers, isLoading: isCustomersLoading, error: customersError } = useQuery(
    ['customers'],
    () => fetch('/api/admin/customers?limit=10').then((res) => res.json())
  );

  if (isAnalyticsLoading || isSubscriptionsLoading || isCustomersLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  if (analyticsError || subscriptionsError || customersError) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Alert variant="destructive">
          <Alert.Title>Error</Alert.Title>
          <Alert.Description>
            {analyticsError?.message || subscriptionsError?.message || customersError?.message || 'An error occurred'}
          </Alert.Description>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
      </div>

      <div className="space-y-6">
        <MetricsCards metrics={analyticsData.metrics} />
        <RevenueChart revenueData={analyticsData.revenueData} />
        <Analytics analytics={analyticsData} />
        <SubscriptionsList subscriptions={subscriptionData} />
        <CustomersList customers={customers} />
      </div>
    </div>
  );
}