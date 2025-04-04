import React, { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Edit, Trash2 } from 'lucide-react';
import { TaxRate } from '@/types/tax';
import { TaxRateHistoryDialog } from './TaxRateHistoryDialog';

interface TaxRatesListProps {
  taxRates: TaxRate[];
  onEdit: (taxRate: TaxRate) => void;
  onDelete: (taxRate: TaxRate) => void;
}

export function TaxRatesList({
  taxRates,
  onEdit,
  onDelete,
}: TaxRatesListProps) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Rate</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {taxRates.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center">
                No tax rates found
              </TableCell>
            </TableRow>
          ) : (
            taxRates.map((taxRate) => (
              <TableRow key={taxRate.id}>
                <TableCell>{taxRate.name}</TableCell>
                <TableCell>{taxRate.rate}%</TableCell>
                <TableCell>
                  {[taxRate.country, taxRate.state, taxRate.city]
                    .filter(Boolean)
                    .join(', ')}
                </TableCell>
                <TableCell>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      taxRate.isActive
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {taxRate.isActive ? 'Active' : 'Inactive'}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end space-x-2">
                    <TaxRateHistoryDialog
                      taxRateId={taxRate.id}
                      taxRateName={taxRate.name}
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => onEdit(taxRate)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => onDelete(taxRate)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}