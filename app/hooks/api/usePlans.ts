import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plan } from '@/types/models';
import { ApiResponse } from '@/types/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

interface PlanFilters {
  isActive?: boolean;
  interval?: 'month' | 'year';
  sortBy?: 'price' | 'name';
  sortOrder?: 'asc' | 'desc';
}

async function fetchPlans(filters: PlanFilters = {}): Promise<Plan[]> {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined) {
      params.append(key, String(value));
    }
  });

  const response = await fetch(`${API_URL}/plans?${params.toString()}`);
  if (!response.ok) {
    throw new Error('Failed to fetch plans');
  }
  return response.json();
}

async function createPlan(data: Partial<Plan>): Promise<ApiResponse<Plan>> {
  const response = await fetch(`${API_URL}/plans`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error('Failed to create plan');
  }
  return response.json();
}

async function updatePlan(id: string, data: Partial<Plan>): Promise<ApiResponse<Plan>> {
  const response = await fetch(`${API_URL}/plans/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error('Failed to update plan');
  }
  return response.json();
}

async function togglePlanStatus(id: string): Promise<ApiResponse<Plan>> {
  const response = await fetch(`${API_URL}/plans/${id}/toggle-status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!response.ok) {
    throw new Error('Failed to toggle plan status');
  }
  return response.json();
}

export function usePlans(filters: PlanFilters = {}) {
  return useQuery({
    queryKey: ['plans', filters],
    queryFn: () => fetchPlans(filters),
  });
}

export function useCreatePlan() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: createPlan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
    },
  });
}

export function useUpdatePlan() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Plan> }) =>
      updatePlan(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
    },
  });
}

export function useTogglePlanStatus() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: togglePlanStatus,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
    },
  });
}