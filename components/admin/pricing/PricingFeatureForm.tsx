'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PlanFeature } from '@/lib/types/pricing';

interface PricingFeatureFormProps {
  initialData?: Partial<PlanFeature>;
  onSubmit: (data: any) => Promise<void>;
  isSubmitting: boolean;
}

export default function PricingFeatureForm({
  initialData,
  onSubmit,
  isSubmitting
}: PricingFeatureFormProps) {
  const router = useRouter();
  const [formData, setFormData] = useState<Partial<PlanFeature>>(initialData || {
    name: '',
    description: '',
    unitName: '',
    isHighlighted: false,
    metadata: {}
  });
  
  const [formErrors, setFormErrors] = useState<{
    [key: string]: string;
  }>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      setFormData({
        ...formData,
        [name]: (e.target as HTMLInputElement).checked
      });
    } else {
      setFormData({
        ...formData,
        [name]: value
      });
    }
  };

  const validateForm = () => {
    const errors: {[key: string]: string} = {};
    
    if (!formData.name) {
      errors.name = 'Name is required';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    await onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">Feature Information</h3>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              Feature Name*
            </label>
            <input
              type="text"
              name="name"
              id="name"
              value={formData.name || ''}
              onChange={handleChange}
              className={`mt-1 block w-full rounded-md border ${formErrors.name ? 'border-red-500' : 'border-gray-300'} shadow-sm p-2 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm`}
            />
            {formErrors.name && <p className="mt-1 text-sm text-red-500">{formErrors.name}</p>}
          </div>
          
          <div className="sm:col-span-2">
            <label htmlFor="description" className="block text-sm font-medium text-gray-700">
              Description
            </label>
            <textarea
              name="description"
              id="description"
              rows={3}
              value={formData.description || ''}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm p-2 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
          
          <div>
            <label htmlFor="unitName" className="block text-sm font-medium text-gray-700">
              Unit Name (for limited access)
            </label>
            <input
              type="text"
              name="unitName"
              id="unitName"
              value={formData.unitName || ''}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm p-2 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              placeholder="e.g. users, projects, API calls"
            />
          </div>
          
          <div className="flex items-center">
            <input
              type="checkbox"
              name="isHighlighted"
              id="isHighlighted"
              checked={!!formData.isHighlighted}
              onChange={handleChange}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="isHighlighted" className="ml-2 block text-sm text-gray-700">
              Highlight in plan comparison
            </label>
          </div>
        </div>
      </div>
      
      <div className="flex justify-end space-x-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Saving...' : 'Save Feature'}
        </button>
      </div>
    </form>
  );
} 