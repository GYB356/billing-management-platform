import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';

const taxExemptionSchema = z.object({
  customerId: z.string().min(1, 'Customer is required'),
  taxRateId: z.string().min(1, 'Tax rate is required'),
  startDate: z.date(),
  endDate: z.date().optional(),
  reason: z.string().optional(),
});

type TaxExemptionFormData = z.infer<typeof taxExemptionSchema>;

interface TaxExemptionFormProps {
  customers: Array<{
    id: string;
    name: string;
  }>;
  taxRates: Array<{
    id: string;
    name: string;
    rate: number;
  }>;
  onSubmit: (data: TaxExemptionFormData) => Promise<void>;
}

export function TaxExemptionForm({
  customers,
  taxRates,
  onSubmit,
}: TaxExemptionFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<TaxExemptionFormData>({
    resolver: zodResolver(taxExemptionSchema),
    defaultValues: {
      startDate: new Date(),
    },
  });

  const handleSubmit = async (data: TaxExemptionFormData) => {
    try {
      setIsSubmitting(true);
      await onSubmit(data);
      toast({
        title: 'Success',
        description: 'Tax exemption created successfully',
      });
      form.reset();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create tax exemption',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="customerId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Customer</FormLabel>
              <Select
                onValueChange={field.onChange}
                defaultValue={field.value}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a customer" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="taxRateId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tax Rate</FormLabel>
              <Select
                onValueChange={field.onChange}
                defaultValue={field.value}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a tax rate" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {taxRates.map((taxRate) => (
                    <SelectItem key={taxRate.id} value={taxRate.id}>
                      {taxRate.name} ({taxRate.rate}%)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="startDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Start Date</FormLabel>
              <FormControl>
                <DatePicker
                  date={field.value}
                  onDateChange={field.onChange}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="endDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>End Date (Optional)</FormLabel>
              <FormControl>
                <DatePicker
                  date={field.value}
                  onDateChange={field.onChange}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="reason"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Reason (Optional)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Enter reason for tax exemption"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Creating...' : 'Create Tax Exemption'}
        </Button>
      </form>
    </Form>
  );
} 