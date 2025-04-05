import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell
} from 'recharts';
import { CurrencyService } from '@/lib/currency';
import { format, subMonths } from 'date-fns';
import { Loader2 } from 'lucide-react';

interface HistoricalData {
  revenue: Array<{
    date: string;
    value: number;
  }>;
  customerSegments: Array<{
    name: string;
    value: number;
  }>;
  subscriptionTrends: Array<{
    date: string;
    active: number;
    churned: number;
  }>;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

export function HistoricalMetrics() {
  const [data, setData] = useState<HistoricalData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState('revenue');

  useEffect(() => {
    const fetchHistoricalData = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch('/api/analytics/historical');
        if (!response.ok) {
          throw new Error('Failed to fetch historical data');
        }
        const result = await response.json();
        if (!result) {
          throw new Error('No data received');
        }
        setData(result);
      } catch (error) {
        console.error('Error fetching historical data:', error);
        setError(error instanceof Error ? error.message : 'An error occurred while fetching data');
      } finally {
        setLoading(false);
      }
    };

    fetchHistoricalData();
  }, []);

  if (loading) {
    return (
      <Card className="mt-6">
        <CardContent className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="mt-6">
        <CardContent>
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card className="mt-6">
        <CardContent>
          <Alert>
            <AlertTitle>No Data Available</AlertTitle>
            <AlertDescription>Historical metrics data is not available at this time.</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Historical Analysis</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeView} onValueChange={setActiveView}>
          <TabsList>
            <TabsTrigger value="revenue">Revenue History</TabsTrigger>
            <TabsTrigger value="segments">Customer Segments</TabsTrigger>
            <TabsTrigger value="subscriptions">Subscription Trends</TabsTrigger>
          </TabsList>

          <TabsContent value="revenue" className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.revenue}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(date) => format(new Date(date), 'MMM yyyy')}
                />
                <YAxis 
                  tickFormatter={(value) => CurrencyService.formatCurrency(value, 'USD')}
                />
                <Tooltip
                  formatter={(value) => CurrencyService.formatCurrency(Number(value), 'USD')}
                  labelFormatter={(label) => format(new Date(label), 'MMMM yyyy')}
                />
                <Line type="monotone" dataKey="value" stroke="#8884d8" />
              </LineChart>
            </ResponsiveContainer>
          </TabsContent>

          <TabsContent value="segments" className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.customerSegments}
                  cx="50%"
                  cy="50%"
                  outerRadius={150}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                >
                  {data.customerSegments.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </TabsContent>

          <TabsContent value="subscriptions" className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.subscriptionTrends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date"
                  tickFormatter={(date) => format(new Date(date), 'MMM yyyy')}
                />
                <YAxis />
                <Tooltip
                  labelFormatter={(label) => format(new Date(label), 'MMMM yyyy')}
                />
                <Bar dataKey="active" fill="#82ca9d" name="Active" />
                <Bar dataKey="churned" fill="#ff7675" name="Churned" />
              </BarChart>
            </ResponsiveContainer>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}