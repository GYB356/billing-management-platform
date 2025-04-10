import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { TaxRateSelector } from '@/components/invoice/TaxRateSelector';
import { TaxRate } from '@/types/tax';
import { calculateTax } from '@/lib/utils/tax';

const invoiceSchema = z.object({
  customerName: z.string().min(1, 'Customer name is required'),
  customerEmail: z.string().email('Invalid email address'),
  items: z.array(
    z.object({
      description: z.string().min(1, 'Description is required'),
      quantity: z.number().min(1, 'Quantity must be at least 1'),
      unitPrice: z.number().min(0, 'Unit price must be positive'),
    })
  ),
  taxRateId: z.string().optional(),
  notes: z.string().optional(),
});

interface InvoiceFormProps {
  initialData?: z.infer<typeof invoiceSchema>;
  onSubmit: (data: z.infer<typeof invoiceSchema>) => void;
  isLoading?: boolean;
}

export function InvoiceForm({
  initialData,
  onSubmit,
  isLoading = false,
}: InvoiceFormProps) {
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);
  const [subtotal, setSubtotal] = useState(0);
  const [taxAmount, setTaxAmount] = useState(0);
  const [total, setTotal] = useState(0);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<z.infer<typeof invoiceSchema>>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: initialData || {
      customerName: '',
      customerEmail: '',
      items: [{ description: '', quantity: 1, unitPrice: 0 }],
      taxRateId: '',
      notes: '',
    },
  });

  useEffect(() => {
    fetchTaxRates();
  }, []);

  const fetchTaxRates = async () => {
    try {
      const response = await fetch('/api/tax-rates');
      const data = await response.json();
      setTaxRates(data);
    } catch (error) {
      console.error('Failed to fetch tax rates:', error);
    }
  };

  const items = watch('items');
  const selectedTaxRateId = watch('taxRateId');

  useEffect(() => {
    const newSubtotal = items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0
    );
    setSubtotal(newSubtotal);

    const selectedTaxRate = taxRates.find(
      (rate) => rate.id === selectedTaxRateId
    );
    const taxResult = calculateTax(newSubtotal, selectedTaxRate ? [selectedTaxRate] : []);
    setTaxAmount(taxResult.taxAmount);
    setTotal(taxResult.total);
  }, [items, selectedTaxRateId, taxRates]);

  const addItem = () => {
    const currentItems = watch('items');
    setValue('items', [
      ...currentItems,
      { description: '', quantity: 1, unitPrice: 0 },
    ]);
  };

  const removeItem = (index: number) => {
    const currentItems = watch('items');
    setValue(
      'items',
      currentItems.filter((_, i) => i !== index)
    );
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="customerName">Customer Name</Label>
          <Input
            id="customerName"
            {...register('customerName')}
            placeholder="Enter customer name"
          />
          {errors.customerName && (
            <p className="text-sm text-red-500">{errors.customerName.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="customerEmail">Customer Email</Label>
          <Input
            id="customerEmail"
            type="email"
            {...register('customerEmail')}
            placeholder="Enter customer email"
          />
          {errors.customerEmail && (
            <p className="text-sm text-red-500">{errors.customerEmail.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>Items</Label>
          <Button type="button" onClick={addItem} variant="outline" size="sm">
            Add Item
          </Button>
        </div>

        {items.map((_, index) => (
          <div key={index} className="grid grid-cols-4 gap-4">
            <div className="col-span-2">
              <Input
                {...register(`items.${index}.description`)}
                placeholder="Description"
              />
            </div>
            <div>
              <Input
                type="number"
                {...register(`items.${index}.quantity`, {
                  valueAsNumber: true,
                })}
                placeholder="Quantity"
              />
            </div>
            <div className="flex gap-2">
              <Input
                type="number"
                step="0.01"
                {...register(`items.${index}.unitPrice`, {
                  valueAsNumber: true,
                })}
                placeholder="Unit Price"
              />
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => removeItem(index)}
              >
                Remove
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <Label>Tax Rate</Label>
        <TaxRateSelector
          taxRates={taxRates}
          selectedTaxRateId={selectedTaxRateId}
          onSelect={(taxRateId) => setValue('taxRateId', taxRateId)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          {...register('notes')}
          placeholder="Enter invoice notes"
        />
      </div>

      <div className="border-t pt-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-500">Subtotal</p>
            <p className="text-lg font-semibold">${subtotal.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Tax</p>
            <p className="text-lg font-semibold">${taxAmount.toFixed(2)}</p>
          </div>
          <div className="col-span-2">
            <p className="text-sm text-gray-500">Total</p>
            <p className="text-2xl font-bold">${total.toFixed(2)}</p>
          </div>
        </div>
      </div>

      <Button type="submit" disabled={isLoading}>
        {isLoading ? 'Saving...' : 'Save Invoice'}
      </Button>
    </form>
  );
} 