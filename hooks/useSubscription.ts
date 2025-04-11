import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { SubscriptionStatus } from '@prisma/client';

interface Usage {
  metric: string;
  current: number;
  limit: number;
  unit: string;
}

interface Subscription {
  id: string;
  status: SubscriptionStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  planId: string;
  planName: string;
}

export function useSubscription() {
  const { session } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [usage, setUsage] = useState<Usage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (session?.user) {
      fetchSubscriptionData();
      fetchUsageData();
    }
  }, [session]);

  const fetchSubscriptionData = async () => {
    try {
      const response = await fetch('/api/customer/subscription');
      if (!response.ok) throw new Error('Failed to fetch subscription');
      const data = await response.json();
      setSubscription(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch subscription');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsageData = async () => {
    try {
      const response = await fetch('/api/customer/usage');
      if (!response.ok) throw new Error('Failed to fetch usage data');
      const data = await response.json();
      setUsage(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch usage data');
    }
  };

  return {
    subscription,
    usage,
    loading,
    error,
    refresh: () => {
      fetchSubscriptionData();
      fetchUsageData();
    },
  };
}
