'use client';

import { useEffect, useState } from 'react';
import { WithPermission } from '@/components/auth/with-permission';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { usePermissions } from '@/hooks/use-permissions';
import { 
  Loader2, Download, TrendingUp, Users, Package, DollarSign, 
  PieChart as PieChartIcon, BarChart as BarChartIcon, Calendar, Filter
} from 'lucide-react';
import { CurrencyService } from '@/lib/currency';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, PieChart, Pie, Cell, Legend, 
  AreaChart, Area, BarChart, Bar, Brush
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Popover, PopoverContent, PopoverTrigger 
} from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { DateRange } from '@/lib/services/analytics-service';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

export default function EnhancedAnalyticsDashboard() {
  const { loading: permissionsLoading } = usePermissions();
  const [metrics, setMetrics] = useState<any>(null);
  const [advancedMetrics, setAdvancedMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState('30d');
  const [granularity, setGranularity] = useState('month');
  const [activeTab, setActiveTab] = useState('overview');
  const [dateRange, setDateRange] = useState<{
    startDate: Date | undefined;
    endDate: Date | undefined;
  }>({
    startDate: undefined,
    endDate: undefined
  });
  const [isCustomDateRange, setIsCustomDateRange] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Build query parameters
        let queryParams = new URLSearchParams();
        
        if (isCustomDateRange && dateRange.startDate && dateRange.endDate) {
          queryParams.append('startDate', dateRange.startDate.toISOString());
          queryParams.append('endDate', dateRange.endDate.toISOString());
        } else {
          queryParams.append('timeRange', timeRange);
        }
        
        queryParams.append('granularity', granularity);
        
        // Fetch metrics
        const [metricsResponse, advancedResponse] = await Promise.all([
          fetch(`/api/analytics?${queryParams.toString()}`),
          fetch(`/api/analytics/advanced?${queryParams.toString()}&type=all`),
        ]);

        if (!metricsResponse.ok || !advancedResponse.ok) {
          throw new Error('Failed to fetch analytics data');
        }

        const [metricsData, advancedData] = await Promise.all([
          metricsResponse.json(),
          advancedResponse.json(),
        ]);

        setMetrics(metricsData);
        setAdvancedMetrics(advancedData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [timeRange, granularity, isCustomDateRange, dateRange.startDate, dateRange.endDate]);

  const handleExport = async (type: string) => {
    try {
      // Build query parameters
      let queryParams = new URLSearchParams();
      queryParams.append('type', type);
      queryParams.append('format', 'csv');
      
      if (isCustomDateRange && dateRange.startDate && dateRange.endDate) {
        queryParams.append('startDate', dateRange.startDate.toISOString());
        queryParams.append('endDate', dateRange.endDate.toISOString());
      } else {
        queryParams.append('timeRange', timeRange);
      }
      
      const response = await fetch(`/api/analytics/advanced?${queryParams.toString()}`);
      if (!response.ok) throw new Error('Failed to export data');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}-report-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error exporting data:', error);
    }
  };

  const resetDateRange = () => {
    setIsCustomDateRange(false);
    setDateRange({
      startDate: undefined,
      endDate: undefined
    });
  };

  const handleDateRangeChange = (range: any) => {
    if (range.from && range.to) {
      setDateRange({
        startDate: range.from,
        endDate: range.to
      });
      setIsCustomDateRange(true);
    }
  };

  if (permissionsLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-500">{error}</div>
      </div>
    );
  }

  return (
    <WithPermission permission="view:analytics">
      <div className="container mx-auto py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Enhanced Analytics Dashboard</h1>
          <div className="flex gap-4">
            {isCustomDateRange && dateRange.startDate && dateRange.endDate && (
              <Badge variant="outline" className="flex items-center gap-1">
                {format(dateRange.startDate, 'MMM d, yyyy')} - {format(dateRange.endDate, 'MMM d, yyyy')}
                <button onClick={resetDateRange} className="ml-2 text-gray-500 hover:text-gray-700">×</button>
              </Badge>
            )}
            
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Custom Date Range
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <CalendarComponent
                  mode="range"
                  selected={{
                    from: dateRange.startDate,
                    to: dateRange.endDate
                  }}
                  onSelect={handleDateRangeChange}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>

            {!isCustomDateRange && (
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select time range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="90d">Last 90 days</SelectItem>
                  <SelectItem value="ytd">Year to date</SelectItem>
                  <SelectItem value="mtd">Month to date</SelectItem>
                </SelectContent>
              </Select>
            )}
            
            <Select value={granularity} onValueChange={setGranularity}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select granularity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Daily</SelectItem>
                <SelectItem value="week">Weekly</SelectItem>
                <SelectItem value="month">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="revenue">Revenue</TabsTrigger>
            <TabsTrigger value="customers">Customers</TabsTrigger>
            <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
            <TabsTrigger value="products">Products</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            {metrics && (
              <>
                {/* Revenue Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4" />
                        Monthly Recurring Revenue
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold">
                        {CurrencyService.formatCurrency(metrics.revenue.mrr, 'USD')}
                      </p>
                      <p className={`text-sm ${metrics.revenue.growth >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {metrics.revenue.growth >= 0 ? '+' : ''}{metrics.revenue.growth.toFixed(1)}% from last month
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" />
                        Annual Recurring Revenue
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold">
                        {CurrencyService.formatCurrency(metrics.revenue.arr, 'USD')}
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Active Subscriptions
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold">{metrics.subscriptions.active}</p>
                      <p className="text-sm text-gray-500">
                        {metrics.subscriptions.conversionRate.toFixed(1)}% conversion rate
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Package className="h-4 w-4" />
                        Customer Lifetime Value
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold">
                        {CurrencyService.formatCurrency(metrics.customers.lifetimeValue, 'USD')}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                  {/* Revenue Trend */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Revenue Trend</CardTitle>
                      <CardDescription>
                        Monthly recurring revenue over time
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={advancedMetrics?.revenueData || []}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" />
                            <YAxis />
                            <Tooltip formatter={(value) => CurrencyService.formatCurrency(Number(value), 'USD')} />
                            <Area 
                              type="monotone" 
                              dataKey="value" 
                              stroke="#8884d8" 
                              fill="#8884d8"
                              fillOpacity={0.3} 
                            />
                            <Brush dataKey="date" height={30} stroke="#8884d8" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Subscription Distribution */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Subscription Distribution</CardTitle>
                      <CardDescription>
                        Breakdown of subscriptions by plan
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={advancedMetrics?.subscriptionData?.distribution?.byPlan || []}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              label={({ name, percentage }) => `${name} ${percentage.toFixed(1)}%`}
                              outerRadius={80}
                              fill="#8884d8"
                              dataKey="count"
                              nameKey="name"
                            >
                              {advancedMetrics?.subscriptionData?.distribution?.byPlan?.map((entry: any, index: number) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(value, name) => [value, name]} />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="revenue">
            {advancedMetrics && (
              <div className="space-y-8">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold">Revenue Analytics</h2>
                  <Button onClick={() => handleExport('revenue')}>
                    <Download className="h-4 w-4 mr-2" />
                    Export Report
                  </Button>
                </div>

                {/* Revenue KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  <Card>
                    <CardHeader>
                      <CardTitle>MRR Growth</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold">
                        {advancedMetrics.subscriptionData?.metrics?.monthlyGrowth?.toFixed(1)}%
                      </p>
                      <p className="text-sm text-gray-500">Monthly growth rate</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>ARR</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold">
                        {CurrencyService.formatCurrency(advancedMetrics.subscriptionData?.metrics?.arr || 0, 'USD')}
                      </p>
                      <p className="text-sm text-gray-500">Annual recurring revenue</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Net Revenue Retention</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold">
                        {metrics?.revenue?.netRevenueRetention?.toFixed(1)}%
                      </p>
                      <p className="text-sm text-gray-500">From existing customers</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Revenue Forecast */}
                <Card className="mb-8">
                  <CardHeader>
                    <CardTitle>Revenue Forecast</CardTitle>
                    <CardDescription>
                      Projected revenue for the next 12 months
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[400px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={advancedMetrics.revenueForecast || []}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="month" />
                          <YAxis />
                          <Tooltip formatter={(value) => CurrencyService.formatCurrency(Number(value), 'USD')} />
                          <Legend />
                          <Area
                            type="monotone"
                            dataKey="predicted"
                            stroke="#8884d8"
                            fill="#8884d8"
                            fillOpacity={0.3}
                            name="Predicted Revenue"
                          />
                          <Area
                            type="monotone"
                            dataKey="upperBound"
                            stroke="#82ca9d"
                            fill="#82ca9d"
                            fillOpacity={0.1}
                            name="Upper Bound"
                          />
                          <Area
                            type="monotone"
                            dataKey="lowerBound"
                            stroke="#ffc658"
                            fill="#ffc658"
                            fillOpacity={0.1}
                            name="Lower Bound"
                          />
                          <Brush dataKey="month" height={30} stroke="#8884d8" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Revenue by Plan */}
                <Card className="mb-8">
                  <CardHeader>
                    <CardTitle>Revenue by Plan</CardTitle>
                    <CardDescription>
                      Distribution of revenue across subscription plans
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[400px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={advancedMetrics.productMetrics?.revenueByProduct || []}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip formatter={(value) => CurrencyService.formatCurrency(Number(value), 'USD')} />
                          <Legend />
                          <Bar dataKey="revenue" fill="#8884d8" name="Revenue" />
                          <Bar dataKey="percentage" fill="#82ca9d" name="% of Total" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          <TabsContent value="customers">
            {advancedMetrics && (
              <div className="space-y-8">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold">Customer Analytics</h2>
                  <Button onClick={() => handleExport('customers')}>
                    <Download className="h-4 w-4 mr-2" />
                    Export Report
                  </Button>
                </div>

                {/* Customer KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6 mb-8">
                  <Card>
                    <CardHeader>
                      <CardTitle>CAC</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold">
                        {CurrencyService.formatCurrency(advancedMetrics.customerMetrics?.acquisitionCost || 0, 'USD')}
                      </p>
                      <p className="text-sm text-gray-500">Customer acquisition cost</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>LTV</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold">
                        {CurrencyService.formatCurrency(advancedMetrics.customerMetrics?.lifetimeValue || 0, 'USD')}
                      </p>
                      <p className="text-sm text-gray-500">Lifetime value</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>LTV:CAC</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold">
                        {(advancedMetrics.customerMetrics?.lifetimeValue / advancedMetrics.customerMetrics?.acquisitionCost || 0).toFixed(1)}
                      </p>
                      <p className="text-sm text-gray-500">Value to cost ratio</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Churn Rate</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold">
                        {advancedMetrics.customerMetrics?.churnRate?.toFixed(1)}%
                      </p>
                      <p className="text-sm text-gray-500">Monthly customer churn</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>NPS</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold">
                        {advancedMetrics.customerMetrics?.netPromoterScore || 0}
                      </p>
                      <p className="text-sm text-gray-500">Net promoter score</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Customer Acquisition Channels */}
                <Card className="mb-8">
                  <CardHeader>
                    <CardTitle>Acquisition Channels</CardTitle>
                    <CardDescription>
                      How customers are finding your business
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[400px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={advancedMetrics.customerMetrics?.acquisitionChannels || []}
                            cx="50%"
                            cy="50%"
                            labelLine={true}
                            label={({ channel, percentage }) => `${channel} (${percentage}%)`}
                            outerRadius={150}
                            fill="#8884d8"
                            dataKey="percentage"
                            nameKey="channel"
                          >
                            {advancedMetrics.customerMetrics?.acquisitionChannels?.map((entry: any, index: number) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Customer Segmentation */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                  <Card>
                    <CardHeader>
                      <CardTitle>Customers by Plan</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={advancedMetrics.customerMetrics?.segmentation?.byPlan || []}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="segment" />
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey="percentage" fill="#8884d8" name="% of Customers" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Customers by Industry</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={advancedMetrics.customerMetrics?.segmentation?.byIndustry || []}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="segment" />
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey="percentage" fill="#82ca9d" name="% of Customers" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Cohort Analysis */}
                <Card>
                  <CardHeader>
                    <CardTitle>Cohort Analysis</CardTitle>
                    <CardDescription>
                      Customer retention by monthly cohorts
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr>
                            <th className="text-left p-2 border-b font-medium">Cohort</th>
                            <th className="text-center p-2 border-b font-medium">Size</th>
                            {advancedMetrics.cohortAnalysis?.[0]?.periods?.map((period: any, i: number) => (
                              <th key={i} className="text-center p-2 border-b font-medium">
                                Month {period.period + 1}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {advancedMetrics.cohortAnalysis?.map((cohort: any, i: number) => (
                            <tr key={i} className={i % 2 === 0 ? 'bg-gray-50' : ''}>
                              <td className="p-2 border-b">{cohort.date}</td>
                              <td className="p-2 border-b text-center">{cohort.size}</td>
                              {cohort.periods?.map((period: any, j: number) => (
                                <td 
                                  key={j} 
                                  className="p-2 border-b text-center"
                                  style={{ 
                                    backgroundColor: `rgba(136, 132, 216, ${period.retention / 100})`,
                                    color: period.retention > 50 ? 'white' : 'black'
                                  }}
                                >
                                  {period.retention}%
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          <TabsContent value="subscriptions">
            {advancedMetrics && (
              <div className="space-y-8">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold">Subscription Analytics</h2>
                  <Button onClick={() => handleExport('subscriptions')}>
                    <Download className="h-4 w-4 mr-2" />
                    Export Report
                  </Button>
                </div>

                {/* Subscription Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6 mb-8">
                  <Card>
                    <CardHeader>
                      <CardTitle>Active</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold">
                        {advancedMetrics.subscriptionData?.summary?.activeSubscriptions || 0}
                      </p>
                      <p className="text-sm text-gray-500">Active subscriptions</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Churn Rate</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold">
                        {advancedMetrics.subscriptionData?.metrics?.churnRate?.toFixed(1)}%
                      </p>
                      <p className="text-sm text-gray-500">Monthly subscription churn</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Trials</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold">
                        {advancedMetrics.subscriptionData?.summary?.trialSubscriptions || 0}
                      </p>
                      <p className="text-sm text-gray-500">Active trials</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Conversion</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold">
                        {advancedMetrics.subscriptionData?.metrics?.conversionRate?.toFixed(1)}%
                      </p>
                      <p className="text-sm text-gray-500">Trial to paid conversion</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Avg. Length</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold">
                        {advancedMetrics.subscriptionData?.metrics?.averageSubscriptionLength?.toFixed(1)} mo
                      </p>
                      <p className="text-sm text-gray-500">Average subscription length</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Subscription Distribution */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                  <Card>
                    <CardHeader>
                      <CardTitle>Distribution by Plan</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={advancedMetrics.subscriptionData?.distribution?.byPlan || []}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              label={({ name, percentage }) => `${name} ${percentage}%`}
                              outerRadius={120}
                              fill="#8884d8"
                              dataKey="count"
                              nameKey="name"
                            >
                              {advancedMetrics.subscriptionData?.distribution?.byPlan?.map((entry: any, index: number) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Distribution by Billing Cycle</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={advancedMetrics.subscriptionData?.distribution?.byBillingCycle || []}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              label={({ cycle, percentage }) => `${cycle} ${percentage}%`}
                              outerRadius={120}
                              fill="#8884d8"
                              dataKey="count"
                              nameKey="cycle"
                            >
                              {advancedMetrics.subscriptionData?.distribution?.byBillingCycle?.map((entry: any, index: number) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Subscription Upgrades/Downgrades */}
                <Card>
                  <CardHeader>
                    <CardTitle>Plan Changes</CardTitle>
                    <CardDescription>
                      Subscription upgrades and downgrades
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={[
                            {
                              name: 'Upgrades',
                              count: advancedMetrics.subscriptionData?.trends?.upgrades || 0,
                              revenue: advancedMetrics.subscriptionData?.trends?.expansionRevenue || 0
                            },
                            {
                              name: 'Downgrades',
                              count: advancedMetrics.subscriptionData?.trends?.downgrades || 0,
                              revenue: advancedMetrics.subscriptionData?.trends?.contractionRevenue || 0
                            }
                          ]}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
                          <YAxis 
                            yAxisId="right" 
                            orientation="right" 
                            stroke="#82ca9d"
                            tickFormatter={(value) => `$${value}`}
                          />
                          <Tooltip />
                          <Legend />
                          <Bar yAxisId="left" dataKey="count" fill="#8884d8" name="Count" />
                          <Bar yAxisId="right" dataKey="revenue" fill="#82ca9d" name="Revenue Impact ($)" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          <TabsContent value="products">
            {advancedMetrics && (
              <div className="space-y-8">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold">Product Analytics</h2>
                  <Button onClick={() => handleExport('products')}>
                    <Download className="h-4 w-4 mr-2" />
                    Export Report
                  </Button>
                </div>

                {/* Product Distribution */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                  <Card>
                    <CardHeader>
                      <CardTitle>Popular Products</CardTitle>
                      <CardDescription>
                        Subscription distribution by product
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={advancedMetrics.productMetrics?.popularProducts || []}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              label={({ name, percentage }) => `${name} ${percentage}%`}
                              outerRadius={120}
                              fill="#8884d8"
                              dataKey="count"
                              nameKey="name"
                            >
                              {advancedMetrics.productMetrics?.popularProducts?.map((entry: any, index: number) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Revenue by Product</CardTitle>
                      <CardDescription>
                        Distribution of revenue across products
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={advancedMetrics.productMetrics?.revenueByProduct || []}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              label={({ name, percentage }) => `${name} ${percentage}%`}
                              outerRadius={120}
                              fill="#8884d8"
                              dataKey="revenue"
                              nameKey="name"
                            >
                              {advancedMetrics.productMetrics?.revenueByProduct?.map((entry: any, index: number) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(value) => CurrencyService.formatCurrency(Number(value), 'USD')} />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Product Growth Chart */}
                <Card className="mb-8">
                  <CardHeader>
                    <CardTitle>Growth by Product</CardTitle>
                    <CardDescription>
                      Monthly growth rate percentage by product
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={Object.entries(advancedMetrics.productMetrics?.growthByProduct || {}).map(([name, value]) => ({
                            name,
                            growth: value
                          }))}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip formatter={(value) => [`${value}%`, 'Growth Rate']} />
                          <Legend />
                          <Bar dataKey="growth" fill="#8884d8" name="Growth Rate (%)" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Feature Usage */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <Card>
                    <CardHeader>
                      <CardTitle>Most Used Features</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart 
                            data={advancedMetrics.productMetrics?.features?.mostUsed || []}
                            layout="vertical"
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" />
                            <YAxis dataKey="feature" type="category" width={150} />
                            <Tooltip />
                            <Bar dataKey="usageCount" fill="#8884d8" name="Usage Count" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Least Used Features</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart 
                            data={advancedMetrics.productMetrics?.features?.leastUsed || []}
                            layout="vertical"
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" />
                            <YAxis dataKey="feature" type="category" width={150} />
                            <Tooltip />
                            <Bar dataKey="usageCount" fill="#82ca9d" name="Usage Count" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </WithPermission>
  );
} 