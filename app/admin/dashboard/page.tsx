'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { realTimeMetricsService, RealTimeMetrics } from '@/lib/services/real-time-metrics';
import { HistoricalMetrics } from '@/components/admin/HistoricalMetrics';
import { exportMetricsAsCSV, exportMetricsAsPDF } from '@/utils/export-metrics';
import { Button } from '@/components/ui/button';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area
} from 'recharts';
import { CurrencyService } from '@/lib/currency';
import { DollarSign, TrendingUp, Users, AlertTriangle } from 'lucide-react';

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const [metrics, setMetrics] = useState<RealTimeMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'authenticated' && session?.user.role !== 'admin') {
      setError('Access denied. You do not have permission to view this page.');
    }
  }, [status, session]);

  useEffect(() => {
    const handleMetricsUpdate = (newMetrics: RealTimeMetrics) => {
      setMetrics(newMetrics);
      setLoading(false);
      setError(null);
    };

    const handleError = (error: Error) => {
      setError(error.message || 'Failed to update metrics');
      // Don't set loading to false here to show stale data if available
    };

    realTimeMetricsService.onMetricsUpdate(handleMetricsUpdate);
    realTimeMetricsService.onError(handleError);
    realTimeMetricsService.startUpdates(30000);

    return () => {
      realTimeMetricsService.stopUpdates();
      realTimeMetricsService.removeListener(handleMetricsUpdate);
      realTimeMetricsService.removeErrorListener(handleError);
    };
  }, []);

  const handleExportCSV = () => {
    if (metrics) {
      exportMetricsAsCSV([metrics], 'admin-metrics.csv');
    }
  };

  const handleExportPDF = () => {
    if (metrics) {
      exportMetricsAsPDF([metrics], 'admin-metrics.pdf');
    }
  };

  if (status === 'loading') {
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

  if (loading && !metrics) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
          <Button onClick={() => realTimeMetricsService.startUpdates()} className="mt-4">
            Retry
          </Button>
        </Alert>
      )}

      {/* Export Buttons */}
      <div className="flex justify-end mb-6">
        <Button onClick={handleExportCSV} className="mr-2">
          Export as CSV
        </Button>
        <Button onClick={handleExportPDF} variant="secondary">
          Export as PDF
        </Button>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Recurring Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{CurrencyService.formatCurrency(metrics?.mrr || 0, 'USD')}</div>
            <p className={metrics?.revenue.growth && metrics.revenue.growth >= 0 ? "text-green-500 text-sm" : "text-red-500 text-sm"}>
              {metrics?.revenue.growth ? `${metrics.revenue.growth >= 0 ? '+' : ''}${metrics.revenue.growth.toFixed(1)}%` : '0%'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.activeSubscriptions || 0}</div>
            <p className="text-muted-foreground text-sm">
              {metrics?.churnRate ? `${metrics.churnRate.toFixed(1)}% churn rate` : '0% churn rate'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Customer Lifetime Value</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{CurrencyService.formatCurrency(metrics?.ltv || 0, 'USD')}</div>
            <p className="text-muted-foreground text-sm">Per customer average</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Revenue Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={[
                    { name: 'Previous', value: metrics?.revenue.monthly || 0 },
                    { name: 'Current', value: metrics?.revenue.monthly || 0 },
                  ]}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value) => CurrencyService.formatCurrency(Number(value), 'USD')} />
                  <Area type="monotone" dataKey="value" stroke="#8884d8" fill="#8884d8" fillOpacity={0.3} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Customer Growth</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={[
                    { name: 'Total', value: metrics?.customers.total || 0 },
                    { name: 'Active', value: metrics?.customers.active || 0 },
                    { name: 'New', value: metrics?.customers.new || 0 },
                  ]}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="value" stroke="#82ca9d" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Historical Metrics Section */}
      <HistoricalMetrics />
    </div>
  );
}