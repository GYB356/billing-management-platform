import { useState, useEffect } from 'react';
import { TaxRate } from '@prisma/client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatTaxRate } from '@/lib/utils/tax-calculations';

interface TaxRateSelectorProps {
  value?: string;
  onChange: (value: string) => void;
  organizationId: string;
  disabled?: boolean;
}

export function TaxRateSelector({
  value,
  onChange,
  organizationId,
  disabled = false,
}: TaxRateSelectorProps) {
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTaxRates();
  }, [organizationId]);

  const fetchTaxRates = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/tax-rates?organizationId=${organizationId}&isActive=true`
      );
      if (!response.ok) {
        throw new Error('Failed to fetch tax rates');
      }
      const data = await response.json();
      setTaxRates(data);
    } catch (error) {
      console.error('Error fetching tax rates:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled || loading}>
      <SelectTrigger>
        <SelectValue placeholder="Select tax rate" />
      </SelectTrigger>
      <SelectContent>
        {taxRates.map((taxRate) => (
          <SelectItem key={taxRate.id} value={taxRate.id}>
            {taxRate.name} ({formatTaxRate(taxRate.rate)})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
} 