import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { DatePickerWithRange } from '@/components/ui/date-range-picker';
import { LineChart, BarChart } from '@/components/ui/charts';
import { Loader2 } from 'lucide-react';

interface AnalyticsInsight {
  type: string;
  title: string;
  description: string;
  confidence: number;
  data: any;
  recommendations?: string[];
}

interface AnalyticsInsightsProps {
  organizationId: string;
}

export function AnalyticsInsights({ organizationId }: AnalyticsInsightsProps) {
  const [activeTab, setActiveTab] = useState('revenue');
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    to: new Date(),
  });
  const [insights, setInsights] = useState<AnalyticsInsight[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchInsights();
  }, [activeTab, dateRange, organizationId]);

  const fetchInsights = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        type: activeTab,
        organizationId,
        startDate: dateRange.from.toISOString(),
        endDate: dateRange.to.toISOString(),
      });

      const response = await fetch(`/api/analytics?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch insights');
      }

      const data = await response.json();
      setInsights(data.insights);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const renderInsightCard = (insight: AnalyticsInsight) => (
    <Card key={insight.title} className="mb-4">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          {insight.title}
          <span className={`text-sm px-2 py-1 rounded ${
            insight.confidence > 0.7 ? 'bg-green-100 text-green-800' :
            insight.confidence > 0.4 ? 'bg-yellow-100 text-yellow-800' :
            'bg-red-100 text-red-800'
          }`}>
            {Math.round(insight.confidence * 100)}% confidence
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-gray-600 mb-4">{insight.description}</p>
        {insight.recommendations && insight.recommendations.length > 0 && (
          <div className="mt-4">
            <h4 className="font-semibold mb-2">Recommendations:</h4>
            <ul className="list-disc pl-5">
              {insight.recommendations.map((rec, index) => (
                <li key={index} className="text-gray-600">{rec}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Analytics & Insights</h2>
        <DatePickerWithRange
          value={dateRange}
          onChange={(range) => range && setDateRange(range)}
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="revenue">Revenue Analysis</TabsTrigger>
          <TabsTrigger value="churn">Churn Prediction</TabsTrigger>
          <TabsTrigger value="pricing">Pricing Optimization</TabsTrigger>
        </TabsList>

        {error && (
          <Alert variant="destructive" className="my-4">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <>
            <TabsContent value="revenue" className="space-y-4">
              {insights.map(renderInsightCard)}
            </TabsContent>

            <TabsContent value="churn" className="space-y-4">
              {insights.map(renderInsightCard)}
            </TabsContent>

            <TabsContent value="pricing" className="space-y-4">
              {insights.map(renderInsightCard)}
            </TabsContent>
          </>
        )}
      </Tabs>

      <div className="mt-8">
        <Button onClick={fetchInsights} disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Refreshing...
            </>
          ) : (
            'Refresh Insights'
          )}
        </Button>
      </div>
    </div>
  );
} 