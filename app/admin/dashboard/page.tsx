'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertTriangle } from 'lucide-react';
import AnalyticsSummary from './components/AnalyticsSummary';
import CustomerOverview from './components/CustomerOverview';
import SubscriptionMetrics from './components/SubscriptionMetrics';
import { useRouter } from 'next/navigation';

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  // Analytics data
  const [analyticsData, setAnalyticsData] = useState({
    metrics: {
      mrr: 0,
      arr: 0,
      activeSubscriptions: 0,
      churnRate: 0,
    },
    revenueData: [],
  });

  // Subscription data
  const [subscriptionData, setSubscriptionData] = useState({
    planDistribution: [],
    churnData: [],
    totalSubscriptions: 0,
    activeTrials: 0,
  });

  // Customer data
  const [customers, setCustomers] = useState([]);

  useEffect(() => {
    if (status === 'authenticated') {
      if (session?.user?.role !== 'admin') {
        setError('Access denied. You do not have permission to view this page.');
        return;
      }
      fetchDashboardData();
    }
  }, [status, session]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [analyticsResponse, subscriptionsResponse, customersResponse] = await Promise.all([
        fetch('/api/admin/analytics/dashboard'),
        fetch('/api/admin/subscriptions/metrics'),
        fetch('/api/admin/customers?limit=10'),
      ]);

      if (!analyticsResponse.ok || !subscriptionsResponse.ok || !customersResponse.ok) {
        throw new Error('Failed to fetch dashboard data');
      }

      const [analytics, subscriptions, customerData] = await Promise.all([
        analyticsResponse.json(),
        subscriptionsResponse.json(),
        customersResponse.json(),
      ]);

      setAnalyticsData(analytics);
      setSubscriptionData(subscriptions);
      setCustomers(customerData.customers);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleCustomerDetails = (customerId: string) => {
    router.push(`/admin/customers/${customerId}`);
  };

  const handleExport = async (format: 'csv' | 'pdf') => {
    try {
      const response = await fetch(`/api/admin/analytics/export?format=${format}`);
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics-export.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <div className="space-x-2">
          <Button onClick={() => handleExport('csv')} variant="outline">
            Export CSV
          </Button>
          <Button onClick={() => handleExport('pdf')}>
            Export PDF
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="customers">Customers</TabsTrigger>
          <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <AnalyticsSummary
            metrics={analyticsData.metrics}
            revenueData={analyticsData.revenueData}
          />
        </TabsContent>

        <TabsContent value="customers">
          <CustomerOverview
            customers={customers}
            onViewDetails={handleCustomerDetails}
          />
        </TabsContent>

        <TabsContent value="subscriptions">
          <SubscriptionMetrics
            planDistribution={subscriptionData.planDistribution}
            churnData={subscriptionData.churnData}
            totalSubscriptions={subscriptionData.totalSubscriptions}
            activeTrials={subscriptionData.activeTrials}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}