'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeftIcon } from '@heroicons/react/24/outline';
import PricingPlanForm from '@/components/admin/pricing/PricingPlanForm';
import { PlanFeature, PricingPlan } from '@/lib/types/pricing';

export default function EditPricingPlanPage({ params }: { params: { planId: string } }) {
  const router = useRouter();
  const [plan, setPlan] = useState<PricingPlan | null>(null);
  const [features, setFeatures] = useState<PlanFeature[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [params.planId]);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Fetch plan and features in parallel
      const [planResponse, featuresResponse] = await Promise.all([
        fetch(`/api/pricing/plans/${params.planId}`),
        fetch('/api/pricing/features')
      ]);
      
      if (!planResponse.ok) {
        throw new Error('Failed to fetch plan details');
      }
      
      if (!featuresResponse.ok) {
        throw new Error('Failed to fetch features');
      }
      
      const [planData, featuresData] = await Promise.all([
        planResponse.json(),
        featuresResponse.json()
      ]);
      
      setPlan(planData);
      setFeatures(featuresData);
    } catch (error) {
      console.error('Error fetching data:', error);
      setError('Failed to load plan data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (data: any) => {
    setIsSubmitting(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/pricing/plans/${params.planId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update plan');
      }

      // Navigate back to plans list on success
      router.push('/admin/pricing/plans');
      router.refresh();
    } catch (error: any) {
      console.error('Error updating plan:', error);
      setError(error.message || 'Failed to update plan. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Transform the plan data to match the form structure
  const prepareInitialData = () => {
    if (!plan) return {};
    
    // Extract feature IDs from plan features
    const planFeatures = plan.planFeatures.map(pf => ({
      featureId: pf.featureId,
      feature: pf.feature
    }));
    
    return {
      ...plan,
      planFeatures
    };
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="sm:flex sm:items-center mb-8">
        <div className="sm:flex-auto">
          <Link
            href="/admin/pricing/plans"
            className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-gray-700"
          >
            <ChevronLeftIcon className="-ml-1 mr-1 h-5 w-5" aria-hidden="true" />
            Back to Plans
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-gray-900">
            Edit Pricing Plan
          </h1>
          {plan && (
            <p className="mt-1 text-sm text-gray-500">
              {plan.name} ({plan.pricingType === 'flat' ? 'Flat Rate' : 
               plan.pricingType === 'per_user' ? 'Per User' : 
               plan.pricingType === 'tiered' ? 'Tiered' : 'Usage Based'})
            </p>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-red-400"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12">
          <svg
            className="mx-auto h-12 w-12 text-gray-400 animate-spin"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          <p className="mt-4 text-sm text-gray-500">Loading plan data...</p>
        </div>
      ) : !plan ? (
        <div className="bg-white shadow sm:rounded-lg">
          <div className="px-4 py-5 sm:p-6 text-center">
            <h3 className="text-base font-semibold leading-6 text-gray-900">Plan Not Found</h3>
            <div className="mt-2 max-w-xl text-sm text-gray-500">
              <p>The requested pricing plan could not be found.</p>
            </div>
            <div className="mt-5">
              <Link
                href="/admin/pricing/plans"
                className="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                Go back to plans
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white shadow sm:rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <PricingPlanForm
              initialData={prepareInitialData()}
              features={features}
              onSubmit={handleSubmit}
              isSubmitting={isSubmitting}
            />
          </div>
        </div>
      )}
    </div>
  );
} 