import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LineChart } from '@/components/ui/charts';
import { formatCurrency } from '@/lib/utils';

interface UsageLimit {
  featureKey: string;
  limit: number;
  interval: string;
  overage: boolean;
  overagePrice?: number;
}

interface UsageRecord {
  featureKey: string;
  quantity: number;
  timestamp: Date;
}

interface UsageMetricsProps {
  subscriptionId: string;
  usageLimits: UsageLimit[];
  currency: string;
}

export function UsageMetrics({
  subscriptionId,
  usageLimits,
  currency,
}: UsageMetricsProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usageData, setUsageData] = useState<Record<string, UsageRecord[]>>({});

  useEffect(() => {
    fetchUsageData();
  }, [subscriptionId]);

  const fetchUsageData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `/api/subscriptions/usage?subscriptionId=${subscriptionId}`
      );
      if (!response.ok) {
        throw new Error('Failed to fetch usage data');
      }

      const data = await response.json();
      setUsageData(data.usage);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const calculateUsagePercentage = (featureKey: string) => {
    const limit = usageLimits.find(l => l.featureKey === featureKey)?.limit || 0;
    const usage = usageData[featureKey]?.reduce(
      (sum, record) => sum + record.quantity,
      0
    ) || 0;
    return Math.min((usage / limit) * 100, 100);
  };

  const calculateOverageCharges = (featureKey: string) => {
    const limit = usageLimits.find(l => l.featureKey === featureKey);
    if (!limit?.overage || !limit.overagePrice) return 0;

    const usage = usageData[featureKey]?.reduce(
      (sum, record) => sum + record.quantity,
      0
    ) || 0;

    const overage = Math.max(usage - limit.limit, 0);
    return overage * limit.overagePrice;
  };

  const prepareChartData = (featureKey: string) => {
    if (!usageData[featureKey]) return [];

    const data = usageData[featureKey]
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
      .map(record => ({
        date: new Date(record.timestamp).toLocaleDateString(),
        usage: record.quantity,
      }));

    return data;
  };

  if (loading) {
    return <div>Loading usage metrics...</div>;
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {usageLimits.map(limit => (
        <Card key={limit.featureKey}>
          <CardHeader>
            <CardTitle>{limit.featureKey}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-gray-500">
                    Usage this {limit.interval}
                  </span>
                  <span className="text-sm font-medium">
                    {usageData[limit.featureKey]?.reduce(
                      (sum, record) => sum + record.quantity,
                      0
                    ) || 0}
                    /{limit.limit}
                  </span>
                </div>
                <Progress
                  value={calculateUsagePercentage(limit.featureKey)}
                  className="h-2"
                />
              </div>

              {limit.overage && limit.overagePrice && (
                <div className="text-sm">
                  <span className="text-gray-500">Overage Charges: </span>
                  <span className="font-medium">
                    {formatCurrency(
                      calculateOverageCharges(limit.featureKey),
                      currency
                    )}
                  </span>
                  <span className="text-gray-500">
                    {' '}
                    ({formatCurrency(limit.overagePrice, currency)}/unit over limit)
                  </span>
                </div>
              )}

              <div className="h-48">
                <LineChart
                  data={prepareChartData(limit.featureKey)}
                  dataKey="usage"
                  xAxisKey="date"
                  stroke="#8884d8"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
} 