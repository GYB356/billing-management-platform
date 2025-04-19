import React from 'react';
import { Form } from '../forms/Form';
import { FormField } from '../forms/FormField';
import { Select } from '../forms/Select';
import { Textarea } from '../forms/Textarea';
import { Checkbox } from '../forms/Checkbox';
import { planSchema } from '@/lib/validations';
import { useCreatePlan, useUpdatePlan } from '@/hooks/api/usePlans';
import { Plan } from '@/types/models';

interface PlanFormProps {
  plan?: Plan;
  onSuccess?: () => void;
}

export function PlanForm({ plan, onSuccess }: PlanFormProps) {
  const createPlan = useCreatePlan();
  const updatePlan = useUpdatePlan();

  const onSubmit = async (data: Plan) => {
    try {
      if (plan) {
        await updatePlan.mutateAsync({ id: plan.id, data });
      } else {
        await createPlan.mutateAsync(data);
      }
      onSuccess?.();
    } catch (error) {
      console.error('Failed to save plan:', error);
    }
  };

  const intervalOptions = [
    { value: 'month', label: 'Monthly' },
    { value: 'year', label: 'Yearly' },
  ];

  const currencyOptions = [
    { value: 'USD', label: 'US Dollar' },
    { value: 'EUR', label: 'Euro' },
    { value: 'GBP', label: 'British Pound' },
  ];

  return (
    <Form
      schema={planSchema}
      onSubmit={onSubmit}
      className="space-y-6"
      formProps={{
        defaultValues: plan,
      }}
    >
      <FormField
        name="name"
        label="Plan Name"
        description="Enter a descriptive name for the plan"
        required
      />

      <Textarea
        name="description"
        label="Description"
        description="Describe the features and benefits of this plan"
        required
      />

      <div className="grid grid-cols-2 gap-4">
        <FormField
          name="price"
          label="Price"
          type="number"
          min={0}
          step={0.01}
          description="Enter the plan price"
          required
        />

        <Select
          name="currency"
          label="Currency"
          options={currencyOptions}
          description="Select the currency"
          required
        />
      </div>

      <Select
        name="interval"
        label="Billing Interval"
        options={intervalOptions}
        description="How often will customers be billed?"
        required
      />

      <div className="space-y-4">
        <h3 className="text-lg font-medium">Features</h3>
        <div className="grid gap-2">
          {[1, 2, 3, 4].map((index) => (
            <FormField
              key={index}
              name={`features.${index - 1}`}
              label={`Feature ${index}`}
              description="Enter a key feature of this plan"
            />
          ))}
        </div>
      </div>

      <Checkbox
        name="isActive"
        label="Active"
        description="Make this plan available for purchase"
      />

      <div className="flex justify-end">
        <button
          type="submit"
          className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary/90"
          disabled={createPlan.isPending || updatePlan.isPending}
        >
          {plan ? 'Update Plan' : 'Create Plan'}
        </button>
      </div>
    </Form>
  );
} 