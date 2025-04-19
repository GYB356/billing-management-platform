import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Subscription } from '@/types/models';
import { ApiResponse, SubscriptionFilters, PaginatedResponse } from '@/types/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

async function fetchSubscriptions(filters: SubscriptionFilters): Promise<PaginatedResponse<Subscription>> {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) {
      if (value instanceof Date) {
        params.append(key, value.toISOString());
      } else {
        params.append(key, String(value));
      }
    }
  });
  
  const response = await fetch(`${API_URL}/subscriptions?${params.toString()}`);
  if (!response.ok) {
    throw new Error('Failed to fetch subscriptions');
  }
  return response.json();
}

async function createSubscription(data: Partial<Subscription>): Promise<ApiResponse<Subscription>> {
  const response = await fetch(`${API_URL}/subscriptions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error('Failed to create subscription');
  }
  return response.json();
}

async function updateSubscriptionStatus(
  id: string,
  status: Subscription['status']
): Promise<ApiResponse<Subscription>> {
  const response = await fetch(`${API_URL}/subscriptions/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  if (!response.ok) {
    throw new Error('Failed to update subscription status');
  }
  return response.json();
}

async function cancelSubscription(id: string): Promise<ApiResponse<Subscription>> {
  const response = await fetch(`${API_URL}/subscriptions/${id}/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!response.ok) {
    throw new Error('Failed to cancel subscription');
  }
  return response.json();
}

export function useSubscriptions(filters: SubscriptionFilters = {}) {
  return useQuery({
    queryKey: ['subscriptions', filters],
    queryFn: () => fetchSubscriptions(filters),
  });
}

export function useCreateSubscription() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: createSubscription,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
    },
  });
}

export function useUpdateSubscriptionStatus() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: Subscription['status'] }) =>
      updateSubscriptionStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
    },
  });
}

export function useCancelSubscription() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => cancelSubscription(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
    },
  });
} 