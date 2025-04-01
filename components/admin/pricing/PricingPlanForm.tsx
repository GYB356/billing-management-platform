'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PlusIcon, MinusIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { PricingPlan, PlanFeature, PricingTier } from '@/lib/types/pricing';

interface PricingPlanFormProps {
  initialData?: Partial<PricingPlan>;
  features?: PlanFeature[];
  onSubmit: (data: any) => Promise<void>;
  isSubmitting: boolean;
}

export default function PricingPlanForm({
  initialData = {},
  features = [],
  onSubmit,
  isSubmitting
}: PricingPlanFormProps) {
  const router = useRouter();
  const [formData, setFormData] = useState<Partial<PricingPlan>>({
    name: '',
    description: '',
    pricingType: 'flat',
    basePrice: 0,
    currency: 'USD',
    billingInterval: 'monthly',
    trialDays: 0,
    sortOrder: 0,
    isActive: true,
    isPublic: true,
    ...initialData
  });
  
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [tiers, setTiers] = useState<PricingTier[]>(initialData.tiers || []);
  const [isFormDirty, setIsFormDirty] = useState(false);

  useEffect(() => {
    if (initialData.planFeatures) {
      setSelectedFeatures(initialData.planFeatures.map(pf => pf.featureId));
    }
  }, [initialData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    let parsedValue: any = value;
    
    if (type === 'number') {
      parsedValue = value === '' ? '' : Number(value);
    } else if (type === 'checkbox') {
      parsedValue = (e.target as HTMLInputElement).checked;
    }
    
    setFormData({
      ...formData,
      [name]: parsedValue
    });
    
    // Clear error for this field if it exists
    if (formErrors[name]) {
      setFormErrors({
        ...formErrors,
        [name]: ''
      });
    }
    
    setIsFormDirty(true);
  };

  const handleFeatureToggle = (featureId: string) => {
    setSelectedFeatures(prev => {
      if (prev.includes(featureId)) {
        return prev.filter(id => id !== featureId);
      } else {
        return [...prev, featureId];
      }
    });
    
    setIsFormDirty(true);
  };

  const addTier = () => {
    setTiers([
      ...tiers,
      {
        id: `new-${Date.now()}`,
        upTo: null,
        price: 0,
        flatFee: 0,
        perUnitFee: 0,
        infinite: false
      }
    ]);
    
    setIsFormDirty(true);
  };

  const removeTier = (index: number) => {
    setTiers(tiers.filter((_, i) => i !== index));
    setIsFormDirty(true);
  };

  const updateTier = (index: number, field: string, value: any) => {
    const updatedTiers = [...tiers];
    updatedTiers[index] = {
      ...updatedTiers[index],
      [field]: field === 'upTo' || field === 'price' || field === 'flatFee' || field === 'perUnitFee' 
        ? value === '' || value === null 
          ? null 
          : Number(value)
        : value
    };
    
    setTiers(updatedTiers);
    setIsFormDirty(true);
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    
    if (!formData.name?.trim()) {
      errors.name = 'Plan name is required';
    }
    
    if (formData.pricingType === 'flat' && (formData.basePrice === undefined || formData.basePrice < 0)) {
      errors.basePrice = 'Price must be 0 or greater';
    }
    
    if (formData.trialDays !== undefined && formData.trialDays < 0) {
      errors.trialDays = 'Trial days must be 0 or greater';
    }
    
    if (formData.pricingType === 'tiered' && tiers.length === 0) {
      errors.tiers = 'At least one pricing tier is required';
    }
    
    if (formData.pricingType === 'tiered') {
      // Check for valid tier configuration
      for (let i = 0; i < tiers.length; i++) {
        const tier = tiers[i];
        if (!tier.infinite && (tier.upTo === null || tier.upTo <= 0)) {
          errors[`tier_${i}_upTo`] = 'Upper limit must be greater than 0';
        }
        
        if (tier.price === null && formData.pricingType !== 'usage_based') {
          errors[`tier_${i}_price`] = 'Price is required';
        }
      }
      
      // Check for overlapping tiers
      for (let i = 0; i < tiers.length - 1; i++) {
        if (!tiers[i].infinite && !tiers[i+1].infinite && tiers[i].upTo >= tiers[i+1].upTo) {
          errors[`tier_${i+1}_upTo`] = 'Tier limits must be in ascending order';
        }
      }
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    // Prepare the data for submission
    const dataToSubmit = {
      ...formData,
      basePrice: formData.pricingType === 'tiered' ? 0 : formData.basePrice,
      tiers: formData.pricingType === 'tiered' ? tiers : [],
      selectedFeatures
    };
    
    try {
      await onSubmit(dataToSubmit);
      setIsFormDirty(false);
    } catch (error) {
      console.error('Error submitting form:', error);
    }
  };

  const renderPricingTypeSection = () => {
    switch (formData.pricingType) {
      case 'flat':
        return (
          <div className="sm:col-span-2">
            <label htmlFor="basePrice" className="block text-sm font-medium text-gray-700">
              Price
            </label>
            <div className="mt-1">
              <div className="relative rounded-md shadow-sm">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <span className="text-gray-500 sm:text-sm">
                    {formData.currency === 'USD' ? '$' : 
                     formData.currency === 'EUR' ? '€' : 
                     formData.currency === 'GBP' ? '£' : '$'}
                  </span>
                </div>
                <input
                  type="number"
                  name="basePrice"
                  id="basePrice"
                  className="block w-full rounded-md border-gray-300 pl-7 pr-12 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  placeholder="0.00"
                  value={formData.basePrice === 0 ? '0' : formData.basePrice}
                  onChange={handleChange}
                />
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                  <span className="text-gray-500 sm:text-sm">/ {formData.billingInterval}</span>
                </div>
              </div>
              {formErrors.basePrice && (
                <p className="mt-2 text-sm text-red-600">{formErrors.basePrice}</p>
              )}
            </div>
          </div>
        );
        
      case 'per_user':
        return (
          <div className="sm:col-span-2">
            <label htmlFor="basePrice" className="block text-sm font-medium text-gray-700">
              Price Per User
            </label>
            <div className="mt-1">
              <div className="relative rounded-md shadow-sm">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <span className="text-gray-500 sm:text-sm">
                    {formData.currency === 'USD' ? '$' : 
                     formData.currency === 'EUR' ? '€' : 
                     formData.currency === 'GBP' ? '£' : '$'}
                  </span>
                </div>
                <input
                  type="number"
                  name="basePrice"
                  id="basePrice"
                  className="block w-full rounded-md border-gray-300 pl-7 pr-12 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  placeholder="0.00"
                  value={formData.basePrice === 0 ? '0' : formData.basePrice}
                  onChange={handleChange}
                />
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                  <span className="text-gray-500 sm:text-sm">/ user / {formData.billingInterval}</span>
                </div>
              </div>
              {formErrors.basePrice && (
                <p className="mt-2 text-sm text-red-600">{formErrors.basePrice}</p>
              )}
            </div>
          </div>
        );
        
      case 'tiered':
        return (
          <div className="sm:col-span-6">
            <div className="flex justify-between items-center">
              <label className="block text-sm font-medium text-gray-700">
                Pricing Tiers
              </label>
              <button
                type="button"
                onClick={addTier}
                className="inline-flex items-center rounded-md border border-transparent bg-indigo-100 px-3 py-2 text-sm font-medium leading-4 text-indigo-700 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                <PlusIcon className="-ml-0.5 mr-2 h-4 w-4" aria-hidden="true" />
                Add Tier
              </button>
            </div>
            
            {formErrors.tiers && (
              <p className="mt-2 text-sm text-red-600">{formErrors.tiers}</p>
            )}
            
            <div className="mt-4 overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
              <table className="min-w-full divide-y divide-gray-300">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Tier Range
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Price
                    </th>
                    <th scope="col" className="relative px-6 py-3">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {tiers.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="whitespace-nowrap px-6 py-4 text-sm text-center text-gray-500">
                        No tiers defined. Click "Add Tier" to create pricing tiers.
                      </td>
                    </tr>
                  ) : (
                    tiers.map((tier, index) => (
                      <tr key={tier.id}>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                          {index === 0 ? (
                            <span>0 to {tier.infinite ? '∞' : tier.upTo}</span>
                          ) : (
                            <div className="flex items-center space-x-2">
                              <span>{tiers[index-1].upTo} to</span>
                              {tier.infinite ? (
                                <span>∞</span>
                              ) : (
                                <input
                                  type="number"
                                  className="block w-24 rounded-md border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                  value={tier.upTo === null ? '' : tier.upTo}
                                  onChange={(e) => updateTier(index, 'upTo', e.target.value)}
                                  min="1"
                                />
                              )}
                              <label className="inline-flex items-center">
                                <input
                                  type="checkbox"
                                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                  checked={tier.infinite}
                                  onChange={(e) => updateTier(index, 'infinite', e.target.checked)}
                                />
                                <span className="ml-2 text-sm text-gray-500">Unlimited</span>
                              </label>
                            </div>
                          )}
                          {formErrors[`tier_${index}_upTo`] && (
                            <p className="mt-1 text-sm text-red-600">{formErrors[`tier_${index}_upTo`]}</p>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                          <div className="relative rounded-md shadow-sm w-32">
                            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                              <span className="text-gray-500 sm:text-sm">
                                {formData.currency === 'USD' ? '$' : 
                                 formData.currency === 'EUR' ? '€' : 
                                 formData.currency === 'GBP' ? '£' : '$'}
                              </span>
                            </div>
                            <input
                              type="number"
                              className="block w-full rounded-md border-gray-300 pl-7 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                              value={tier.price === null ? '' : tier.price}
                              onChange={(e) => updateTier(index, 'price', e.target.value)}
                              min="0"
                            />
                          </div>
                          {formErrors[`tier_${index}_price`] && (
                            <p className="mt-1 text-sm text-red-600">{formErrors[`tier_${index}_price`]}</p>
                          )}
                        </td>
                        <td className="relative whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                          {tiers.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeTier(index)}
                              className="text-red-600 hover:text-red-900"
                            >
                              <XMarkIcon className="h-5 w-5" aria-hidden="true" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
        
      default:
        return null;
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 divide-y divide-gray-200">
      <div className="space-y-8 divide-y divide-gray-200">
        <div>
          <div>
            <h3 className="text-lg font-medium leading-6 text-gray-900">
              {initialData.id ? 'Edit' : 'Create'} Pricing Plan
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Set up the plan details, pricing, and features.
            </p>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
            <div className="sm:col-span-3">
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                Plan Name
              </label>
              <div className="mt-1">
                <input
                  type="text"
                  name="name"
                  id="name"
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  value={formData.name}
                  onChange={handleChange}
                />
                {formErrors.name && (
                  <p className="mt-2 text-sm text-red-600">{formErrors.name}</p>
                )}
              </div>
            </div>

            <div className="sm:col-span-3">
              <label htmlFor="currency" className="block text-sm font-medium text-gray-700">
                Currency
              </label>
              <div className="mt-1">
                <select
                  id="currency"
                  name="currency"
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  value={formData.currency}
                  onChange={handleChange}
                >
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                </select>
              </div>
            </div>

            <div className="sm:col-span-6">
              <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                Description
              </label>
              <div className="mt-1">
                <textarea
                  id="description"
                  name="description"
                  rows={3}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  value={formData.description || ''}
                  onChange={handleChange}
                />
              </div>
              <p className="mt-2 text-sm text-gray-500">
                Brief description of the plan visible to customers.
              </p>
            </div>

            <div className="sm:col-span-3">
              <label htmlFor="pricingType" className="block text-sm font-medium text-gray-700">
                Pricing Type
              </label>
              <div className="mt-1">
                <select
                  id="pricingType"
                  name="pricingType"
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  value={formData.pricingType}
                  onChange={handleChange}
                >
                  <option value="flat">Flat Rate</option>
                  <option value="per_user">Per User</option>
                  <option value="tiered">Tiered</option>
                </select>
              </div>
            </div>

            <div className="sm:col-span-3">
              <label htmlFor="billingInterval" className="block text-sm font-medium text-gray-700">
                Billing Interval
              </label>
              <div className="mt-1">
                <select
                  id="billingInterval"
                  name="billingInterval"
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  value={formData.billingInterval}
                  onChange={handleChange}
                >
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="annual">Annual</option>
                </select>
              </div>
            </div>

            {renderPricingTypeSection()}

            <div className="sm:col-span-2">
              <label htmlFor="trialDays" className="block text-sm font-medium text-gray-700">
                Trial Period (days)
              </label>
              <div className="mt-1">
                <input
                  type="number"
                  name="trialDays"
                  id="trialDays"
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  value={formData.trialDays === 0 ? '0' : formData.trialDays}
                  onChange={handleChange}
                  min="0"
                />
                {formErrors.trialDays && (
                  <p className="mt-2 text-sm text-red-600">{formErrors.trialDays}</p>
                )}
              </div>
              <p className="mt-2 text-sm text-gray-500">
                Set to 0 for no trial period.
              </p>
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="sortOrder" className="block text-sm font-medium text-gray-700">
                Display Order
              </label>
              <div className="mt-1">
                <input
                  type="number"
                  name="sortOrder"
                  id="sortOrder"
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  value={formData.sortOrder === 0 ? '0' : formData.sortOrder}
                  onChange={handleChange}
                  min="0"
                />
              </div>
              <p className="mt-2 text-sm text-gray-500">
                Plans are displayed in ascending order.
              </p>
            </div>

            <div className="sm:col-span-2">
              <div className="flex items-start">
                <div className="flex h-5 items-center">
                  <input
                    id="isActive"
                    name="isActive"
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    checked={formData.isActive}
                    onChange={handleChange}
                  />
                </div>
                <div className="ml-3 text-sm">
                  <label htmlFor="isActive" className="font-medium text-gray-700">
                    Active
                  </label>
                  <p className="text-gray-500">
                    Inactive plans are not available for purchase.
                  </p>
                </div>
              </div>
            </div>

            <div className="sm:col-span-2">
              <div className="flex items-start">
                <div className="flex h-5 items-center">
                  <input
                    id="isPublic"
                    name="isPublic"
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    checked={formData.isPublic}
                    onChange={handleChange}
                  />
                </div>
                <div className="ml-3 text-sm">
                  <label htmlFor="isPublic" className="font-medium text-gray-700">
                    Public
                  </label>
                  <p className="text-gray-500">
                    Private plans are not listed on the pricing page.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {features.length > 0 && (
          <div className="pt-8">
            <div>
              <h3 className="text-lg font-medium leading-6 text-gray-900">Plan Features</h3>
              <p className="mt-1 text-sm text-gray-500">
                Select which features are included in this plan.
              </p>
            </div>
            <div className="mt-6">
              <fieldset>
                <legend className="sr-only">Features</legend>
                <div className="divide-y divide-gray-200">
                  {features.map((feature) => (
                    <div key={feature.id} className="relative flex items-start py-4">
                      <div className="min-w-0 flex-1 text-sm">
                        <label
                          htmlFor={`feature-${feature.id}`}
                          className="font-medium text-gray-700 select-none"
                        >
                          {feature.name}
                        </label>
                        {feature.description && (
                          <p id={`feature-${feature.id}-description`} className="text-gray-500">
                            {feature.description}
                          </p>
                        )}
                      </div>
                      <div className="ml-3 flex h-5 items-center">
                        <input
                          id={`feature-${feature.id}`}
                          name={`feature-${feature.id}`}
                          type="checkbox"
                          className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          checked={selectedFeatures.includes(feature.id)}
                          onChange={() => handleFeatureToggle(feature.id)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </fieldset>
            </div>
          </div>
        )}
      </div>

      <div className="pt-5">
        <div className="flex justify-end">
          <Link
            href="/admin/pricing/plans"
            className="rounded-md border border-gray-300 bg-white py-2 px-4 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting || (!isFormDirty && initialData.id)}
            className={`ml-3 inline-flex justify-center rounded-md border border-transparent py-2 px-4 text-sm font-medium text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
              isSubmitting || (!isFormDirty && initialData.id)
                ? 'bg-indigo-400 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            {isSubmitting ? 'Saving...' : initialData.id ? 'Save Changes' : 'Create Plan'}
          </button>
        </div>
      </div>
    </form>
  );
}