import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';

interface AnalyticsMetrics {
  revenue: {
    total: number;
    recurring: number;
    oneTime: number;
    byPlan: Record<string, number>;
    byCurrency: Record<string, number>;
  };
  subscriptions: {
    total: number;
    active: number;
    canceled: number;
    byPlan: Record<string, number>;
    byStatus: Record<string, number>;
  };
  customers: {
    total: number;
    active: number;
    churned: number;
    new: number;
    byPlan: Record<string, number>;
  };
  usage: {
    total: number;
    byFeature: Record<string, number>;
    byCustomer: Record<string, number>;
  };
  errorRate: number;
}

interface AnalyticsData {
  metrics: AnalyticsMetrics;
  timestamp: Date;
}

export function AnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/analytics');
        if (!response.ok) {
          throw new Error('Failed to fetch analytics data');
        }
        const json = await response.json();
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return <div>Loading analytics data...</div>;
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!data) {
    return <div>No analytics data available</div>;
  }

  const { metrics } = data;

  return (
    <div className="space-y-4">
      {/* Revenue Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-sm font-medium">Total Revenue</p>
              <p className="text-2xl font-bold">
                ${metrics.revenue.total.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium">Recurring Revenue</p>
              <p className="text-2xl font-bold">
                ${metrics.revenue.recurring.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium">One-time Revenue</p>
              <p className="text-2xl font-bold">
                ${metrics.revenue.oneTime.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium">Error Rate</p>
              <p className="text-2xl font-bold">
                {(metrics.errorRate * 100).toFixed(1)}%
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Metrics */}
      <Tabs defaultValue="subscriptions">
        <TabsList>
          <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
          <TabsTrigger value="customers">Customers</TabsTrigger>
          <TabsTrigger value="usage">Usage</TabsTrigger>
        </TabsList>

        <TabsContent value="subscriptions">
          <Card>
            <CardHeader>
              <CardTitle>Subscription Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-sm font-medium">Total Subscriptions</p>
                  <p className="text-2xl font-bold">{metrics.subscriptions.total}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Active Subscriptions</p>
                  <p className="text-2xl font-bold">{metrics.subscriptions.active}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Canceled Subscriptions</p>
                  <p className="text-2xl font-bold">{metrics.subscriptions.canceled}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Churn Rate</p>
                  <p className="text-2xl font-bold">
                    {((metrics.subscriptions.canceled / metrics.subscriptions.total) * 100).toFixed(1)}%
                  </p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium mb-2">Subscriptions by Plan</h4>
                  <div className="space-y-2">
                    {Object.entries(metrics.subscriptions.byPlan).map(([plan, count]) => (
                      <div key={plan} className="flex justify-between">
                        <span className="text-sm">{plan}</span>
                        <span className="text-sm font-medium">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-medium mb-2">Subscriptions by Status</h4>
                  <div className="space-y-2">
                    {Object.entries(metrics.subscriptions.byStatus).map(([status, count]) => (
                      <div key={status} className="flex justify-between">
                        <span className="text-sm">{status}</span>
                        <span className="text-sm font-medium">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="customers">
          <Card>
            <CardHeader>
              <CardTitle>Customer Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-sm font-medium">Total Customers</p>
                  <p className="text-2xl font-bold">{metrics.customers.total}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Active Customers</p>
                  <p className="text-2xl font-bold">{metrics.customers.active}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Churned Customers</p>
                  <p className="text-2xl font-bold">{metrics.customers.churned}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">New Customers</p>
                  <p className="text-2xl font-bold">{metrics.customers.new}</p>
                </div>
              </div>
              <div>
                <h4 className="text-sm font-medium mb-2">Customers by Plan</h4>
                <div className="space-y-2">
                  {Object.entries(metrics.customers.byPlan).map(([plan, count]) => (
                    <div key={plan} className="flex justify-between">
                      <span className="text-sm">{plan}</span>
                      <span className="text-sm font-medium">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="usage">
          <Card>
            <CardHeader>
              <CardTitle>Usage Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-sm font-medium">Total Usage</p>
                  <p className="text-2xl font-bold">{metrics.usage.total}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Active Features</p>
                  <p className="text-2xl font-bold">
                    {Object.keys(metrics.usage.byFeature).length}
                  </p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium mb-2">Usage by Feature</h4>
                  <div className="space-y-2">
                    {Object.entries(metrics.usage.byFeature).map(([feature, usage]) => (
                      <div key={feature} className="space-y-1">
                        <div className="flex justify-between">
                          <span className="text-sm">{feature}</span>
                          <span className="text-sm font-medium">{usage}</span>
                        </div>
                        <Progress
                          value={(usage / metrics.usage.total) * 100}
                          className="h-1"
                        />
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-medium mb-2">Usage by Customer</h4>
                  <div className="space-y-2">
                    {Object.entries(metrics.usage.byCustomer).map(([customer, usage]) => (
                      <div key={customer} className="space-y-1">
                        <div className="flex justify-between">
                          <span className="text-sm">{customer}</span>
                          <span className="text-sm font-medium">{usage}</span>
                        </div>
                        <Progress
                          value={(usage / metrics.usage.total) * 100}
                          className="h-1"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
} 