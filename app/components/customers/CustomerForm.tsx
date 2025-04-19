import React from 'react';
import { Form } from '../forms/Form';
import { FormField } from '../forms/FormField';
import { Select } from '../forms/Select';
import { Textarea } from '../forms/Textarea';
import { Checkbox } from '../forms/Checkbox';
import { customerSchema } from '@/lib/validations';
import { useCreateCustomer, useUpdateCustomer } from '@/hooks/api/useCustomers';
import { Customer } from '@/types/models';

interface CustomerFormProps {
  customer?: Customer;
  onSuccess?: () => void;
}

export function CustomerForm({ customer, onSuccess }: CustomerFormProps) {
  const createCustomer = useCreateCustomer();
  const updateCustomer = useUpdateCustomer();

  const onSubmit = async (data: Customer) => {
    try {
      if (customer) {
        await updateCustomer.mutateAsync({ id: customer.id, data });
      } else {
        await createCustomer.mutateAsync(data);
      }
      onSuccess?.();
    } catch (error) {
      console.error('Failed to save customer:', error);
    }
  };

  return (
    <Form
      schema={customerSchema}
      onSubmit={onSubmit}
      className="space-y-6"
      formProps={{
        defaultValues: customer,
      }}
    >
      <FormField
        name="companyName"
        label="Company Name"
        description="Enter the company's legal name"
      />
      
      <FormField
        name="contactName"
        label="Contact Name"
        description="Enter the primary contact person's name"
        required
      />
      
      <FormField
        name="email"
        label="Email"
        type="email"
        description="Enter the primary contact email"
        required
      />
      
      <FormField
        name="phone"
        label="Phone"
        type="tel"
        description="Enter the contact phone number"
      />
      
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Address Information</h3>
        
        <FormField
          name="address.street"
          label="Street Address"
        />
        
        <div className="grid grid-cols-2 gap-4">
          <FormField
            name="address.city"
            label="City"
          />
          
          <FormField
            name="address.state"
            label="State"
          />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <FormField
            name="address.postalCode"
            label="Postal Code"
          />
          
          <Select
            name="address.country"
            label="Country"
            options={[
              { value: 'US', label: 'United States' },
              { value: 'CA', label: 'Canada' },
              { value: 'GB', label: 'United Kingdom' },
            ]}
          />
        </div>
      </div>
      
      <Textarea
        name="notes"
        label="Additional Notes"
        description="Any additional information about the customer"
      />
      
      <Checkbox
        name="marketingConsent"
        label="Marketing Consent"
        description="Allow us to send marketing communications"
      />
      
      <div className="flex justify-end">
        <button
          type="submit"
          className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary/90"
          disabled={createCustomer.isPending || updateCustomer.isPending}
        >
          {customer ? 'Update Customer' : 'Create Customer'}
        </button>
      </div>
    </Form>
  );
}