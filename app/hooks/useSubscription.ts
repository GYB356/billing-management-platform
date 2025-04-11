import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

interface Plan {
  id: string;
  name: string;
  price: number;
  currency: string;
  interval: string;
  usageLimits: Array<{
    id: string;
    featureKey: string;
    limit: number;
    used: number;
  }>;
}

interface Payment {
  id: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
}

interface Subscription {
  id: string;
  status: 'ACTIVE' | 'PAUSED' | 'CANCELED' | 'PAST_DUE';
  plan: Plan;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  trialEndsAt?: string;
  pausedAt?: string;
  resumesAt?: string;
  payments: Payment[];
}

export function useSubscription() {
  const [isChangingPlan, setIsChangingPlan] = useState(false);

  const { data: subscription, isLoading, error, refetch } = useQuery<Subscription>({
    queryKey: ['subscription'],
    queryFn: async () => {
      const response = await fetch('/api/subscriptions/current');
      if (!response.ok) {
        throw new Error('Failed to fetch subscription');
      }
      return response.json();
    },
  });

  const changePlanMutation = useMutation({
    mutationFn: async (newPlanId: string) => {
      const response = await fetch('/api/subscriptions/change-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: newPlanId }),
      });
      if (!response.ok) {
        throw new Error('Failed to change plan');
      }
      return response.json();
    },
    onSuccess: () => {
      toast.success('Successfully changed plan');
      refetch();
      setIsChangingPlan(false);
    },
    onError: (error) => {
      toast.error('Failed to change plan: ' + error.message);
      setIsChangingPlan(false);
    },
  });

  const cancelSubscriptionMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/subscriptions/cancel', {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('Failed to cancel subscription');
      }
      return response.json();
    },
    onSuccess: () => {
      toast.success('Successfully cancelled subscription');
      refetch();
    },
    onError: (error) => {
      toast.error('Failed to cancel subscription: ' + error.message);
    },
  });

  const resumeSubscriptionMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/subscriptions/resume', {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('Failed to resume subscription');
      }
      return response.json();
    },
    onSuccess: () => {
      toast.success('Successfully resumed subscription');
      refetch();
    },
    onError: (error) => {
      toast.error('Failed to resume subscription: ' + error.message);
    },
  });

  const changePlan = async (newPlanId: string) => {
    setIsChangingPlan(true);
    await changePlanMutation.mutateAsync(newPlanId);
  };

  const cancelSubscription = async () => {
    if (window.confirm('Are you sure you want to cancel your subscription?')) {
      await cancelSubscriptionMutation.mutateAsync();
    }
  };

  const resumeSubscription = async () => {
    await resumeSubscriptionMutation.mutateAsync();
  };

  return {
    subscription,
    loading: isLoading,
    error,
    isChangingPlan,
    changePlan,
    cancelSubscription,
    resumeSubscription,
  };
} 