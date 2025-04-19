import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../utils/api';
import { InvoiceFormData, Customer } from '../types';

export const useInvoiceForm = (initialData?: Partial<InvoiceFormData>) => {
  const [formData, setFormData] = useState<InvoiceFormData>({
    customer: '',
    items: [],
    dueDate: new Date(),
    notes: '',
    ...initialData
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: customers, isLoading, error } = useQuery<Customer[]>({
    queryKey: ['customers'],
    queryFn: () => api.get('/customers').then(res => res.data)
  });

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.customer) {
      newErrors.customer = 'Customer is required';
    }
    if (!formData.items.length) {
      newErrors.items = 'At least one item is required';
    }
    if (!formData.dueDate) {
      newErrors.dueDate = 'Due date is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return null;
    }

    try {
      const response = await api.post('/invoices', formData);
      return response.data;
    } catch (error) {
      setErrors({ submit: 'Failed to create invoice' });
      return null;
    }
  };

  return {
    formData,
    setFormData,
    errors,
    customers,
    isLoading,
    error,
    handleSubmit
  };
}; 