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
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/use-toast';
import { TaxRate } from '@/types/tax';
import { createTaxRateHistory } from '@/lib/utils/tax-history';
import { useSession } from 'next-auth/react';

const taxRateSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  rate: z.number().min(0).max(100, 'Rate must be between 0 and 100'),
  country: z.string().min(1, 'Country is required'),
  state: z.string().optional(),
  city: z.string().optional(),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
});

interface TaxRateFormProps {
  initialData?: TaxRate;
  onSubmit: (data: z.infer<typeof taxRateSchema>) => Promise<void>;
  onCancel: () => void;
}

export function TaxRateForm({
  initialData,
  onSubmit,
  onCancel,
}: TaxRateFormProps) {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);

  const form = useForm<z.infer<typeof taxRateSchema>>({
    resolver: zodResolver(taxRateSchema),
    defaultValues: initialData || {
      name: '',
      rate: 0,
      country: '',
      state: '',
      city: '',
      description: '',
      isActive: true,
    },
  });

  const handleSubmit = async (data: z.infer<typeof taxRateSchema>) => {
    try {
      setLoading(true);
      await onSubmit(data);

      // Create history entry if this is an update
      if (initialData && session?.user?.id) {
        await createTaxRateHistory({
          taxRate: initialData,
          changedBy: session.user.id,
          reason: 'Tax rate updated',
        });
      }

      toast({
        title: 'Success',
        description: `Tax rate ${initialData ? 'updated' : 'created'} successfully`,
      });
    } catch (error) {
      console.error('Error submitting tax rate:', error);
      toast({
        title: 'Error',
        description: 'Failed to save tax rate',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="rate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Rate (%)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="0.01"
                  {...field}
                  onChange={(e) => field.onChange(parseFloat(e.target.value))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="country"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Country</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="state"
          render={({ field }) => (
            <FormItem>
              <FormLabel>State/Province</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="city"
          render={({ field }) => (
            <FormItem>
              <FormLabel>City</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="isActive"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel>Active</FormLabel>
                <div className="text-sm text-muted-foreground">
                  Enable or disable this tax rate
                </div>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <div className="flex justify-end space-x-2">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Saving...' : initialData ? 'Update' : 'Create'}
          </Button>
        </div>
      </form>
    </Form>
  );
} 