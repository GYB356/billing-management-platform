'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { formatCurrency } from '@/lib/currency';
import { formatDate } from '@/lib/date';

interface UsageData {
  date: string;
  usage: number;
  cost: number;
}

interface FeatureUsage {
  id: string;
  name: string;
  currentUsage: number;
  limit?: number;
  cost: number;
  unitName?: string;
}

interface UsageAnalyticsDashboardProps {
  subscriptionId: string;
  features: FeatureUsage[];
}

export function UsageAnalyticsDashboard({ subscriptionId, features }: UsageAnalyticsDashboardProps) {
  const [timeRange, setTimeRange] = useState<'7days' | '30days' | 'billing'>('billing');
  const [selectedFeature, setSelectedFeature] = useState<string | 'all'>('all');
  const [usageData, setUsageData] = useState<UsageData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchUsageData();
  }, [timeRange, selectedFeature]);

  const fetchUsageData = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/usage/analytics?subscriptionId=${subscriptionId}&timeRange=${timeRange}${
          selectedFeature !== 'all' ? `&featureId=${selectedFeature}` : ''
        }`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch usage data');
      }

      const data = await response.json();
      setUsageData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const getUsagePercentage = (feature: FeatureUsage) => {
    if (!feature.limit) return null;
    return (feature.currentUsage / feature.limit) * 100;
  };

  const getUsageStatus = (feature: FeatureUsage) => {
    const percentage = getUsagePercentage(feature);
    if (!percentage) return 'normal';
    if (percentage >= 90) return 'critical';
    if (percentage >= 75) return 'warning';
    return 'normal';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Usage Analytics</h2>
        <div className="flex gap-4">
          <Select value={timeRange} onValueChange={(value: '7days' | '30days' | 'billing') => setTimeRange(value)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select time range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7days">Last 7 days</SelectItem>
              <SelectItem value="30days">Last 30 days</SelectItem>
              <SelectItem value="billing">Current billing period</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedFeature} onValueChange={setSelectedFeature}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select feature" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All features</SelectItem>
              {features.map((feature) => (
                <SelectItem key={feature.id} value={feature.id}>
                  {feature.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {features.map((feature) => (
          <Card key={feature.id}>
            <CardHeader>
              <CardTitle className="text-lg">{feature.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Current Usage</span>
                  <span className="font-medium">
                    {feature.currentUsage}
                    {feature.unitName && ` ${feature.unitName}`}
                  </span>
                </div>
                {feature.limit && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Limit</span>
                    <span className="font-medium">
                      {feature.limit} {feature.unitName}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Cost</span>
                  <span className="font-medium">{formatCurrency(feature.cost)}</span>
                </div>
                {feature.limit && (
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div
                      className={`h-2.5 rounded-full ${
                        getUsageStatus(feature) === 'critical'
                          ? 'bg-red-500'
                          : getUsageStatus(feature) === 'warning'
                          ? 'bg-yellow-500'
                          : 'bg-green-500'
                      }`}
                      style={{ width: `${Math.min(getUsagePercentage(feature) || 0, 100)}%` }}
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Usage Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-[400px]">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-[400px] text-red-500">
              {error}
            </div>
          ) : (
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={usageData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(date) => formatDate(new Date(date))}
                  />
                  <YAxis
                    yAxisId="left"
                    tickFormatter={(value) => value.toString()}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tickFormatter={(value) => formatCurrency(value)}
                  />
                  <Tooltip
                    labelFormatter={(date) => formatDate(new Date(date))}
                    formatter={(value: number, name: string) => [
                      name === 'cost' ? formatCurrency(value) : value,
                      name === 'cost' ? 'Cost' : 'Usage',
                    ]}
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="usage"
                    stroke="#8884d8"
                    name="Usage"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="cost"
                    stroke="#82ca9d"
                    name="Cost"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 