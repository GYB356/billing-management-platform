import React from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

interface TaxRatesEmptyProps {
  onAddNew: () => void;
}

export function TaxRatesEmpty({ onAddNew }: TaxRatesEmptyProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="rounded-full bg-gray-100 p-4">
        <Plus className="h-8 w-8 text-gray-500" />
      </div>
      <h3 className="mt-4 text-lg font-semibold">No Tax Rates</h3>
      <p className="mt-2 text-sm text-gray-500">
        Get started by creating your first tax rate.
      </p>
      <Button onClick={onAddNew} className="mt-4">
        <Plus className="mr-2 h-4 w-4" />
        Add Tax Rate
      </Button>
    </div>
  );
} 