import { TaxRate } from '@/types/tax';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

export async function getTaxRates(): Promise<TaxRate[]> {
  const response = await fetch(`${API_BASE_URL}/api/tax-rates`);
  if (!response.ok) {
    throw new Error('Failed to fetch tax rates');
  }
  return response.json();
}

export async function createTaxRate(data: Omit<TaxRate, 'id' | 'createdAt' | 'updatedAt'>): Promise<TaxRate> {
  const response = await fetch(`${API_BASE_URL}/api/tax-rates`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error('Failed to create tax rate');
  }
  return response.json();
}

export async function updateTaxRate(id: string, data: Partial<TaxRate>): Promise<TaxRate> {
  const response = await fetch(`${API_BASE_URL}/api/tax-rates/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error('Failed to update tax rate');
  }
  return response.json();
}

export async function deleteTaxRate(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/tax-rates/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to delete tax rate');
  }
} 