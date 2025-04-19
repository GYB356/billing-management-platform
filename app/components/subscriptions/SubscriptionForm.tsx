import React from 'react';
import { Form } from '../forms/Form';
import { FormField } from '../forms/FormField';
import { Select } from '../forms/Select';
import { subscriptionSchema } from '@/lib/validations';
import { useCreateSubscription, useUpdateSubscriptionStatus } from '@/hooks/api/useSubscriptions';
import { usePlans } from '@/hooks/api/usePlans';
import { useCustomers } from '@/hooks/api/useCustomers';
import { Subscription } from '@/types/models';

interface SubscriptionFormProps {
  subscription?: Subscription;
  onSuccess?: () => void;
}

export function SubscriptionForm({ subscription, onSuccess }: SubscriptionFormProps) {
  const createSubscription = useCreateSubscription();
  const updateStatus = useUpdateSubscriptionStatus();
  const { data: plans, isLoading: plansLoading } = usePlans({ isActive: true });
  const { data: customers } = useCustomers();

  const onSubmit = async (data: Subscription) => {
    try {
      if (subscription) {
        await updateStatus.mutateAsync({
          id: subscription.id,
          status: data.status,
        });
      } else {
        await createSubscription.mutateAsync(data);
      }
      onSuccess?.();
    } catch (error) {
      console.error('Failed to save subscription:', error);
    }
  };

  if (plansLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const planOptions = plans?.map((plan) => ({
    value: plan.id,
    label: `${plan.name} - ${plan.price} ${plan.currency}/${plan.interval}`,
  })) || [];

  const customerOptions = customers?.data.map((customer) => ({
    value: customer.id,
    label: customer.companyName || customer.contactName,
  })) || [];

  const statusOptions = [
    { value: 'active', label: 'Active' },
    { value: 'canceled', label: 'Canceled' },
    { value: 'suspended', label: 'Suspended' },
  ];

  return (
    <Form
      schema={subscriptionSchema}
      onSubmit={onSubmit}
      className="space-y-6"
      formProps={{
        defaultValues: subscription,
      }}
    >
      <Select
        name="customerId"
        label="Customer"
        options={customerOptions}
        description="Select the customer for this subscription"
        required
      />

      <Select
        name="planId"
        label="Plan"
        options={planOptions}
        description="Select the subscription plan"
        required
      />

      {subscription && (
        <Select
          name="status"
          label="Status"
          options={statusOptions}
          description="Update subscription status"
          required
        />
      )}

      <FormField
        name="currentPeriodStart"
        label="Start Date"
        type="date"
        description="When does the subscription period start?"
        required
      />

      <FormField
        name="currentPeriodEnd"
        label="End Date"
        type="date"
        description="When does the subscription period end?"
        required
      />

      <div className="flex justify-end">
        <button
          type="submit"
          className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary/90"
          disabled={createSubscription.isPending || updateStatus.isPending}
        >
          {subscription ? 'Update Subscription' : 'Create Subscription'}
        </button>
      </div>
    </Form>
  );
} 