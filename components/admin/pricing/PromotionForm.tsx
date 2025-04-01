'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BillingPromotion, PricingPlan, PlanFeature, PromotionType } from '@/lib/types/pricing';

interface PromotionFormProps {
  initialData?: Partial<BillingPromotion>;
  plans: PricingPlan[];
  features: PlanFeature[];
  onSubmit: (data: any) => Promise<void>;
  isSubmitting: boolean;
}

export default function PromotionForm({
  initialData,
  plans,
  features,
  onSubmit,
  isSubmitting
}: PromotionFormProps) {
  const router = useRouter();
  const [formData, setFormData] = useState<Partial<BillingPromotion>>(initialData || {
    code: '',
    name: '',
    description: '',
    promotionType: 'percentage',
    value: 0,
    isActive: true,
    isStackable: false,
    startDate: new Date().toISOString().slice(0, 10),
    appliesTo: {
      planIds: [],
      featureIds: []
    }
  });
  
  const [selectedPlans, setSelectedPlans] = useState<string[]>([]);
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [formErrors, setFormErrors] = useState<{
    [key: string]: string;
  }>({});

  useEffect(() => {
    if (initialData && initialData.appliesTo) {
      setSelectedPlans(initialData.appliesTo.planIds || []);
      setSelectedFeatures(initialData.appliesTo.featureIds || []);
    }
  }, [initialData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      setFormData({
        ...formData,
        [name]: (e.target as HTMLInputElement).checked
      });
    } else if (name === 'value' && type === 'number') {
      setFormData({
        ...formData,
        [name]: parseFloat(value)
      });
    } else {
      setFormData({
        ...formData,
        [name]: value
      });
    }
  };

  const handlePlanToggle = (planId: string) => {
    if (selectedPlans.includes(planId)) {
      setSelectedPlans(selectedPlans.filter(id => id !== planId));
    } else {
      setSelectedPlans([...selectedPlans, planId]);
    }
  };
  
  const handleFeatureToggle = (featureId: string) => {
    if (selectedFeatures.includes(featureId)) {
      setSelectedFeatures(selectedFeatures.filter(id => id !== featureId));
    } else {
      setSelectedFeatures([...selectedFeatures, featureId]);
    }
  };

  const validateForm = () => {
    const errors: {[key: string]: string} = {};
    
    if (!formData.code) {
      errors.code = 'Promotion code is required';
    }
    
    if (!formData.name) {
      errors.name = 'Name is required';
    }
    
    if (formData.value === undefined || formData.value < 0) {
      errors.value = 'Value is required and must be positive';
    }
    
    if (formData.promotionType === 'percentage' && formData.value && formData.value > 100) {
      errors.value = 'Percentage cannot exceed 100%';
    }
    
    if (!formData.startDate) {
      errors.startDate = 'Start date is required';
    }
    
    if (selectedPlans.length === 0 && selectedFeatures.length === 0) {
      errors.appliesTo = 'Promotion must apply to at least one plan or feature';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    const submitData = {
      ...formData,
      appliesTo: {
        planIds: selectedPlans,
        featureIds: selectedFeatures
      }
    };
    
    await onSubmit(submitData);
  };

  const promotionTypes: { value: PromotionType; label: string }[] = [
    { value: 'percentage', label: 'Percentage Discount' },
    { value: 'fixed_amount', label: 'Fixed Amount' },
    { value: 'free_period', label: 'Free Period (days)' }
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">Promotion Information</h3>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <label htmlFor="code" className="block text-sm font-medium text-gray-700">
              Promotion Code*
            </label>
            <input
              type="text"
              name="code"
              id="code"
              value={formData.code || ''}
              onChange={handleChange}
              className={`mt-1 block w-full rounded-md border ${formErrors.code ? 'border-red-500' : 'border-gray-300'} shadow-sm p-2 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm`}
              placeholder="SUMMER25"
            />
            {formErrors.code && <p className="mt-1 text-sm text-red-500">{formErrors.code}</p>}
          </div>
          
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              Promotion Name*
            </label>
            <input
              type="text"
              name="name"
              id="name"
              value={formData.name || ''}
              onChange={handleChange}
              className={`mt-1 block w-full rounded-md border ${formErrors.name ? 'border-red-500' : 'border-gray-300'} shadow-sm p-2 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm`}
              placeholder="Summer Sale"
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
              rows={2}
              value={formData.description || ''}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm p-2 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              placeholder="25% off all premium plans for new customers"
            />
          </div>
          
          <div>
            <label htmlFor="promotionType" className="block text-sm font-medium text-gray-700">
              Discount Type
            </label>
            <select
              name="promotionType"
              id="promotionType"
              value={formData.promotionType || 'percentage'}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm p-2 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              {promotionTypes.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label htmlFor="value" className="block text-sm font-medium text-gray-700">
              {formData.promotionType === 'percentage' ? 'Discount Percentage*' :
               formData.promotionType === 'fixed_amount' ? 'Discount Amount*' :
               'Free Days*'}
            </label>
            <div className="mt-1 relative rounded-md shadow-sm">
              <input
                type="number"
                name="value"
                id="value"
                value={formData.value || ''}
                onChange={handleChange}
                className={`block w-full rounded-md border ${formErrors.value ? 'border-red-500' : 'border-gray-300'} shadow-sm p-2 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${formData.promotionType === 'percentage' ? 'pr-12' : formData.promotionType === 'fixed_amount' ? 'pl-7' : ''}`}
                min="0"
                max={formData.promotionType === 'percentage' ? '100' : undefined}
                step={formData.promotionType === 'fixed_amount' ? '0.01' : '1'}
              />
              {formData.promotionType === 'percentage' && (
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <span className="text-gray-500 sm:text-sm">%</span>
                </div>
              )}
              {formData.promotionType === 'fixed_amount' && (
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-gray-500 sm:text-sm">$</span>
                </div>
              )}
            </div>
            {formErrors.value && <p className="mt-1 text-sm text-red-500">{formErrors.value}</p>}
          </div>
          
          <div>
            <label htmlFor="maxRedemptions" className="block text-sm font-medium text-gray-700">
              Maximum Redemptions
            </label>
            <input
              type="number"
              name="maxRedemptions"
              id="maxRedemptions"
              value={formData.maxRedemptions || ''}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm p-2 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              min="1"
              placeholder="Unlimited"
            />
          </div>
          
          <div>
            <label htmlFor="startDate" className="block text-sm font-medium text-gray-700">
              Start Date*
            </label>
            <input
              type="date"
              name="startDate"
              id="startDate"
              value={formData.startDate?.toString().slice(0, 10) || ''}
              onChange={handleChange}
              className={`mt-1 block w-full rounded-md border ${formErrors.startDate ? 'border-red-500' : 'border-gray-300'} shadow-sm p-2 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm`}
            />
            {formErrors.startDate && <p className="mt-1 text-sm text-red-500">{formErrors.startDate}</p>}
          </div>
          
          <div>
            <label htmlFor="endDate" className="block text-sm font-medium text-gray-700">
              End Date
            </label>
            <input
              type="date"
              name="endDate"
              id="endDate"
              value={formData.endDate?.toString().slice(0, 10) || ''}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm p-2 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
          
          <div className="flex items-center space-x-6">
            <div className="flex items-center">
              <input
                type="checkbox"
                name="isActive"
                id="isActive"
                checked={formData.isActive !== false}
                onChange={handleChange}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <label htmlFor="isActive" className="ml-2 block text-sm text-gray-700">
                Active
              </label>
            </div>
            
            <div className="flex items-center">
              <input
                type="checkbox"
                name="isStackable"
                id="isStackable"
                checked={!!formData.isStackable}
                onChange={handleChange}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <label htmlFor="isStackable" className="ml-2 block text-sm text-gray-700">
                Stackable with other promotions
              </label>
            </div>
          </div>
        </div>
      </div>
      
      {/* Apply To Section */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">Apply To</h3>
        
        {formErrors.appliesTo && (
          <p className="mb-4 text-sm text-red-500">{formErrors.appliesTo}</p>
        )}
        
        <div className="space-y-6">
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Plans</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {plans.length === 0 ? (
                <p className="text-gray-500 italic">No plans available.</p>
              ) : (
                plans.map(plan => (
                  <div key={plan.id} className="flex items-center">
                    <input
                      type="checkbox"
                      id={`plan-${plan.id}`}
                      checked={selectedPlans.includes(plan.id)}
                      onChange={() => handlePlanToggle(plan.id)}
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <label htmlFor={`plan-${plan.id}`} className="ml-2 block text-sm text-gray-700">
                      {plan.name}
                    </label>
                  </div>
                ))
              )}
            </div>
          </div>
          
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Features</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {features.length === 0 ? (
                <p className="text-gray-500 italic">No features available.</p>
              ) : (
                features.map(feature => (
                  <div key={feature.id} className="flex items-center">
                    <input
                      type="checkbox"
                      id={`feature-${feature.id}`}
                      checked={selectedFeatures.includes(feature.id)}
                      onChange={() => handleFeatureToggle(feature.id)}
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <label htmlFor={`feature-${feature.id}`} className="ml-2 block text-sm text-gray-700">
                      {feature.name}
                    </label>
                  </div>
                ))
              )}
            </div>
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
          {isSubmitting ? 'Saving...' : 'Save Promotion'}
        </button>
      </div>
    </form>
  );
} 