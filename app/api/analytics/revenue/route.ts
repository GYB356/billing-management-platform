'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DatePickerWithRange } from '@/components/ui/date-range-picker';
import { addDays, format, subDays } from 'date-fns';
import { 
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer 
} from 'recharts';

export default function AnalyticsDashboard() {
  const [dateRange, setDateRange] = useState({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      setIsLoading(true);
      try {
        const startDateParam = format(dateRange.from, 'yyyy-MM-dd');
        const endDateParam = format(dateRange.to, 'yyyy-MM-dd');
        
        const response = await fetch(
          `/api/analytics/revenue?startDate=${startDateParam}&endDate=${endDateParam}`
        );
        
        if (!response.ok) {
          throw new Error('Failed to fetch analytics data');
        }
        
        const data = await response.json();
        setAnalyticsData(data);
      } catch (error) {
        console.error('Error fetching analytics:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAnalytics();
  }, [dateRange]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const revenueChartData = analyticsData?.revenueByDay?.map((day: any) => ({
    date: format(new Date(day.date), 'MMM dd'),
    revenue: parseFloat(day.revenue),
  })) || [];

  const customerGrowthData = analyticsData?.customerGrowth?.map((day: any) => ({
    date: format(new Date(day.date), 'MMM dd'),
    newCustomers: parseInt(day.newCustomers),
  })) || [];

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
        <DatePickerWithRange 
          value={dateRange} 
          onChange={(range) => setDateRange(range as {from: Date, to: Date})} 
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle>Monthly Recurring Revenue</CardTitle>
                <CardDescription>Current MRR from all active subscriptions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{formatCurrency(analyticsData?.mrr || 0)}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle>Active Subscriptions</CardTitle>
                <CardDescription>Total number of active subscriptions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{analyticsData?.subscriptionCount || 0}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle>Churn Rate</CardTitle>
                <CardDescription>Percentage of customers who canceled</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{(analyticsData?.churnRate || 0).toFixed(2)}%</div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="revenue" className="w-full">
            <TabsList>
              <TabsTrigger value="revenue">Revenue Trends</TabsTrigger>
              <TabsTrigger value="customers">Customer Growth</TabsTrigger>
            </TabsList>
            
            <TabsContent value="revenue" className="pt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Revenue Over Time</CardTitle>
                  <CardDescription>Daily revenue during selected period</CardDescription>
                </CardHeader>
                <CardContent className="h-96">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={revenueChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis 
                        tickFormatter={(value) => formatCurrency(value)}
                        width={80}
                      />
                      <Tooltip 
                        formatter={(value) => [formatCurrency(value as number), 'Revenue']}
                      />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="revenue" 
                        name="Revenue" 
                        stroke="hsl(var(--chart-1))" 
                        strokeWidth={2}
                        activeDot={{ r: 8 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="customers" className="pt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Customer Growth</CardTitle>
                  <CardDescription>Daily new customer signups</CardDescription>
                </CardHeader>
                <CardContent className="h-96">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={customerGrowthData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar 
                        dataKey="newCustomers" 
                        name="New Customers" 
                        fill="hsl(var(--chart-2))" 
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}