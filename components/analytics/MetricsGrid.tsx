import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface MetricsGridProps {
  isLoading: boolean;
  mrr?: number;
  churnRate?: number;
  subscriptionCount?: number;
}

export default function MetricsGrid({ isLoading, mrr, churnRate, subscriptionCount }: MetricsGridProps) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card className="p-6">
        <h3 className="text-sm font-medium text-muted-foreground">Monthly Recurring Revenue</h3>
        {isLoading ? (
          <Skeleton className="h-7 w-24 mt-2" />
        ) : (
          <p className="text-2xl font-bold">${mrr?.toLocaleString() ?? 0}</p>
        )}
      </Card>

      <Card className="p-6">
        <h3 className="text-sm font-medium text-muted-foreground">Churn Rate</h3>
        {isLoading ? (
          <Skeleton className="h-7 w-16 mt-2" />
        ) : (
          <p className="text-2xl font-bold">{churnRate?.toFixed(1)}%</p>
        )}
      </Card>

      <Card className="p-6">
        <h3 className="text-sm font-medium text-muted-foreground">Active Subscriptions</h3>
        {isLoading ? (
          <Skeleton className="h-7 w-16 mt-2" />
        ) : (
          <p className="text-2xl font-bold">{subscriptionCount?.toLocaleString() ?? 0}</p>
        )}
      </Card>
    </div>
  );
}