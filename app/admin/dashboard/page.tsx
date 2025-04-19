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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DatePicker } from '@/components/ui/DatePicker';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Download, RefreshCw, Filter } from 'lucide-react';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [dateRange, setDateRange] = useState({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
    to: new Date(),
  });
  const [timeframe, setTimeframe] = useState('30d');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Query options with refetch capability
  const queryOptions = {
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  };

  const {
    data: analyticsData,
    isLoading: isAnalyticsLoading,
    error: analyticsError,
    refetch: refetchAnalytics,
  } = useQuery(
    ['analyticsData', timeframe],
    () => fetch(`/api/admin/analytics/dashboard?timeframe=${timeframe}`).then((res) => res.json()),
    queryOptions
  );

  const {
    data: subscriptionData,
    isLoading: isSubscriptionsLoading,
    error: subscriptionsError,
    refetch: refetchSubscriptions,
  } = useQuery(
    ['subscriptionData', timeframe],
    () => fetch(`/api/admin/subscriptions/metrics?timeframe=${timeframe}`).then((res) => res.json()),
    queryOptions
  );

  const {
    data: customers,
    isLoading: isCustomersLoading,
    error: customersError,
    refetch: refetchCustomers,
  } = useQuery(
    ['customers'],
    () => fetch('/api/admin/customers?limit=10').then((res) => res.json()),
    queryOptions
  );

  const refreshData = async () => {
    setIsRefreshing(true);
    await Promise.all([refetchAnalytics(), refetchSubscriptions(), refetchCustomers()]);
    setIsRefreshing(false);
  };

  const handleExportData = () => {
    // Implementation for exporting data
    console.log('Exporting dashboard data...');
    // Actual implementation would depend on your export requirements
  };

  const handleTimeframeChange = (value) => {
    setTimeframe(value);
  };

  if (isAnalyticsLoading || isSubscriptionsLoading || isCustomersLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-2">
            <Select
              value={timeframe}
              onValueChange={handleTimeframeChange}
              options={[
                { label: 'Last 7 days', value: '7d' },
                { label: 'Last 30 days', value: '30d' },
                { label: 'Last quarter', value: '90d' },
                { label: 'Year to date', value: 'ytd' },
                { label: 'Custom', value: 'custom' },
              ]}
              className="w-40"
            />
            
            {timeframe === 'custom' && (
              <div className="flex items-center gap-2">
                <DatePicker
                  selected={dateRange.from}
                  onSelect={(date) => setDateRange({ ...dateRange, from: date })}
                  placeholderText="From"
                  className="w-32"
                />
                <span>to</span>
                <DatePicker
                  selected={dateRange.to}
                  onSelect={(date) => setDateRange({ ...dateRange, to: date })}
                  placeholderText="To"
                  className="w-32"
                />
              </div>
            )}
          </div>
          
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={refreshData} 
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportData}>
              <Download className="h-4 w-4 mr-1" />
              Export
            </Button>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full sm:w-auto grid grid-cols-2 sm:grid-cols-4 mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
          <TabsTrigger value="customers">Customers</TabsTrigger>
          <TabsTrigger value="analytics">Advanced Analytics</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-6">
          <MetricsCards metrics={analyticsData.metrics} />
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="p-4">
              <h2 className="text-xl font-semibold mb-4">Revenue</h2>
              <RevenueChart revenueData={analyticsData.revenueData} />
            </Card>
            <Card className="p-4">
              <h2 className="text-xl font-semibold mb-4">User Growth</h2>
              {/* Assuming your Analytics component has this data - if not, you'd need to implement it */}
              <Analytics analytics={analyticsData} type="userGrowth" />
            </Card>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="p-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Recent Subscriptions</h2>
                <Button variant="link" onClick={() => setActiveTab('subscriptions')}>View all</Button>
              </div>
              <SubscriptionsList subscriptions={subscriptionData.slice(0, 5)} compact />
            </Card>
            <Card className="p-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Recent Customers</h2>
                <Button variant="link" onClick={() => setActiveTab('customers')}>View all</Button>
              </div>
              <CustomersList customers={customers.slice(0, 5)} compact />
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="subscriptions" className="space-y-6">
          <Card className="p-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Subscription Analytics</h2>
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-1" />
                Filter
              </Button>
            </div>
            {/* Assuming Analytics component can show subscription specific data */}
            <Analytics analytics={analyticsData} type="subscriptions" />
          </Card>
          <Card className="p-4">
            <h2 className="text-xl font-semibold mb-4">All Subscriptions</h2>
            <SubscriptionsList subscriptions={subscriptionData} />
          </Card>
        </TabsContent>
        
        <TabsContent value="customers" className="space-y-6">
          <Card className="p-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Customer Analytics</h2>
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-1" />
                Filter
              </Button>
            </div>
            {/* Assuming Analytics component can show customer specific data */}
            <Analytics analytics={analyticsData} type="customers" />
          </Card>
          <Card className="p-4">
            <h2 className="text-xl font-semibold mb-4">All Customers</h2>
            <CustomersList customers={customers} />
          </Card>
        </TabsContent>
        
        <TabsContent value="analytics" className="space-y-6">
          <Card className="p-4">
            <h2 className="text-xl font-semibold mb-4">Advanced Analytics</h2>
            <Analytics analytics={analyticsData} type="advanced" />
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}