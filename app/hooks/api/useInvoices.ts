import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Invoice } from '@/types/models';
import { ApiResponse, InvoiceFilters, PaginatedResponse } from '@/types/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

async function fetchInvoices(filters: InvoiceFilters): Promise<PaginatedResponse<Invoice>> {
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
  
  const response = await fetch(`${API_URL}/invoices?${params.toString()}`);
  if (!response.ok) {
    throw new Error('Failed to fetch invoices');
  }
  return response.json();
}

async function createInvoice(data: Partial<Invoice>): Promise<ApiResponse<Invoice>> {
  const response = await fetch(`${API_URL}/invoices`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error('Failed to create invoice');
  }
  return response.json();
}

async function updateInvoiceStatus(
  id: string,
  status: Invoice['status']
): Promise<ApiResponse<Invoice>> {
  const response = await fetch(`${API_URL}/invoices/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  if (!response.ok) {
    throw new Error('Failed to update invoice status');
  }
  return response.json();
}

export function useInvoices(filters: InvoiceFilters = {}) {
  return useQuery({
    queryKey: ['invoices', filters],
    queryFn: () => fetchInvoices(filters),
  });
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: createInvoice,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
  });
}

export function useUpdateInvoiceStatus() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: Invoice['status'] }) =>
      updateInvoiceStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
  });
}