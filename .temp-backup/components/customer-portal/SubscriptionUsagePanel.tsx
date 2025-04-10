import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';

interface UsageMetric {
  featureId: string;
  featureName: string;
  included: number;
  current: number;
  limit: number | null;
  unit: string;
  overage: number;
  overageRate: number | null;
}

interface UsageSummary {
  subscriptionId: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  metrics: UsageMetric[];
}

async function getUsageSummary(): Promise<UsageSummary> {
  const response = await fetch('/api/subscription/usage/summary');
  if (!response.ok) {
    throw new Error('Failed to fetch usage summary');
  }
  return response.json();
}

export default function SubscriptionUsagePanel() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['usage-summary'],
    queryFn: getUsageSummary,
    refetchInterval: 300000, // Refresh every 5 minutes
  });

  if (isLoading) {
    return <Skeleton className="w-full h-48" />;
  }

  if (error) {
    return <div>Error loading usage metrics</div>;
  }

  const formatDate = (date: string) => format(new Date(date), 'MMM d, yyyy');
  
  return (
    <Card className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-medium">Usage & Limits</h3>
        <p className="text-sm text-gray-500">
          Current period: {formatDate(data.currentPeriodStart)} - {formatDate(data.currentPeriodEnd)}
        </p>
      </div>

      <div className="space-y-6">
        {data.metrics.map((metric) => (
          <div key={metric.featureId} className="space-y-2">
            <div className="flex justify-between items-center">
              <div>
                <h4 className="font-medium">{metric.featureName}</h4>
                <p className="text-sm text-gray-500">
                  {metric.current.toLocaleString()} / {metric.limit ? metric.limit.toLocaleString() : '∞'} {metric.unit}
                </p>
              </div>
              {metric.overage > 0 && metric.overageRate && (
                <Alert variant="warning" className="max-w-xs">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Overage charges may apply: ${(metric.overage * metric.overageRate).toFixed(2)}
                  </AlertDescription>
                </Alert>
              )}
            </div>
            
            <Progress 
              value={metric.limit ? (metric.current / metric.limit) * 100 : 0}
              className="h-2"
              variant={metric.current > (metric.included || 0) ? "warning" : "default"}
            />

            {metric.included > 0 && (
              <p className="text-xs text-gray-500">
                {metric.included.toLocaleString()} {metric.unit} included in plan
                {metric.overageRate && ` • ${metric.overageRate}/unit overage`}
              </p>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}