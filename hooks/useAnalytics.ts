import { useState, useEffect } from 'react';

interface AnalyticsData {
  mrr: number;
  revenueByDay: Array<{
    date: string;
    revenue: number;
  }>;
  customerGrowth: Array<{
    date: string;
    newCustomers: number;
  }>;
  churnRate: number;
  subscriptionCount: number;
}

interface UseAnalyticsProps {
  startDate: Date;
  endDate: Date;
  organizationId?: string;
}

export function useAnalytics({ startDate, endDate, organizationId }: UseAnalyticsProps) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        setIsLoading(true);
        const params = new URLSearchParams({
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          ...(organizationId && { organizationId }),
        });

        const response = await fetch(`/api/analytics/revenue?${params}`);
        if (!response.ok) {
          throw new Error('Failed to fetch analytics data');
        }

        const analyticsData = await response.json();
        setData(analyticsData);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An error occurred'));
      } finally {
        setIsLoading(false);
      }
    }

    fetchAnalytics();
  }, [startDate, endDate, organizationId]);

  return { data, isLoading, error };
}