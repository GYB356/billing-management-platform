import React from 'react';
import { useInvoiceForm } from '../hooks/useInvoiceForm';
import { LoadingSpinner } from './LoadingSpinner';
import { ErrorMessage } from './ErrorMessage';

export const InvoiceForm: React.FC<{ onSubmit?: () => void }> = ({ onSubmit }) => {
  const {
    formData,
    setFormData,
    errors,
    customers,
    isLoading,
    error,
    handleSubmit
  } = useInvoiceForm();

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message="Failed to load customers" />;

  const onFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await handleSubmit();
    if (result && onSubmit) {
      onSubmit();
    }
  };

  return (
    <form onSubmit={onFormSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Customer
        </label>
        <select
          value={formData.customer}
          onChange={(e) => setFormData({ ...formData, customer: e.target.value })}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
        >
          <option value="">Select a customer</option>
          {customers?.map((customer) => (
            <option key={customer._id} value={customer._id}>
              {customer.name}
            </option>
          ))}
        </select>
        {errors.customer && (
          <p className="mt-1 text-sm text-red-600">{errors.customer}</p>
        )}
      </div>

      {/* Add more form fields for items, due date, etc. */}
      
      <button
        type="submit"
        className="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
      >
        Create Invoice
      </button>
    </form>
  );
}; 