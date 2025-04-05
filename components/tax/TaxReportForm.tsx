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
import { DatePicker } from '@/components/ui/date-picker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';

const taxReportSchema = z.object({
  startDate: z.date(),
  endDate: z.date(),
  taxRateIds: z.array(z.string()).min(1, 'Select at least one tax rate'),
});

type TaxReportFormData = z.infer<typeof taxReportSchema>;

interface TaxReportFormProps {
  taxRates: Array<{
    id: string;
    name: string;
    rate: number;
  }>;
  onSubmit: (data: TaxReportFormData) => Promise<void>;
}

export function TaxReportForm({ taxRates, onSubmit }: TaxReportFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<TaxReportFormData>({
    resolver: zodResolver(taxReportSchema),
    defaultValues: {
      startDate: new Date(),
      endDate: new Date(),
      taxRateIds: [],
    },
  });

  const handleSubmit = async (data: TaxReportFormData) => {
    try {
      setIsSubmitting(true);
      await onSubmit(data);
      toast({
        title: 'Success',
        description: 'Tax report generated successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to generate tax report',
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
          name="startDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Start Date</FormLabel>
              <FormControl>
                <DatePicker date={field.value} onDateChange={field.onChange} />
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
              <FormLabel>End Date</FormLabel>
              <FormControl>
                <DatePicker date={field.value} onDateChange={field.onChange} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="taxRateIds"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tax Rates</FormLabel>
              <Select
                onValueChange={value => {
                  const currentValues = field.value || [];
                  if (!currentValues.includes(value)) {
                    field.onChange([...currentValues, value]);
                  }
                }}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select tax rates" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {taxRates.map(taxRate => (
                    <SelectItem key={taxRate.id} value={taxRate.id}>
                      {taxRate.name} ({taxRate.rate}%)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="mt-2 flex flex-wrap gap-2">
                {field.value?.map(id => {
                  const taxRate = taxRates.find(tr => tr.id === id);
                  return (
                    <div
                      key={id}
                      className="flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-sm"
                    >
                      <span>{taxRate?.name}</span>
                      <button
                        type="button"
                        onClick={() => {
                          field.onChange(field.value.filter(v => v !== id));
                        }}
                        className="ml-1 text-primary hover:text-primary/80"
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Generating...' : 'Generate Report'}
        </Button>
      </form>
    </Form>
  );
} 