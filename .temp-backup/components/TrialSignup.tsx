'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

type Plan = {
  id: string;
  name: string;
  trialDays: number;
  features: string[];
};

type TrialSignupProps = {
  plan: Plan;
  organizationId?: string;
  onSuccess?: (data: any) => void;
  className?: string;
};

export default function TrialSignup({
  plan,
  organizationId,
  onSuccess,
  className = '',
}: TrialSignupProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    organizationId: organizationId || '',
    organizationName: '',
    email: '',
    agreeToTerms: false,
  });
  const [successData, setSuccessData] = useState<any>(null);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    });
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.agreeToTerms) {
      setError('Please agree to the terms and conditions');
      return;
    }
    
    // If user is not logged in, redirect to sign in
    if (!session) {
      // Save trial intent in local storage
      localStorage.setItem('trialIntent', JSON.stringify({
        planId: plan.id,
        organizationId: formData.organizationId,
        organizationName: formData.organizationName,
      }));
      
      router.push('/auth/signin');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      // If organizationId not provided, we need to create an organization first
      let orgId = formData.organizationId;
      
      if (!orgId && formData.organizationName) {
        // Create organization first (assuming you have this API endpoint)
        const orgResponse = await fetch('/api/organizations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: formData.organizationName }),
        });
        
        if (!orgResponse.ok) {
          const orgErrorData = await orgResponse.json();
          throw new Error(orgErrorData.message || 'Failed to create organization');
        }
        
        const newOrg = await orgResponse.json();
        orgId = newOrg.id;
      }
      
      if (!orgId) {
        throw new Error('Organization ID is required');
      }
      
      // Create trial subscription
      const response = await fetch('/api/subscriptions/trial', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          organizationId: orgId,
          planId: plan.id,
          trialDays: plan.trialDays,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || data.error || 'Failed to create trial');
      }
      
      // Set success state
      setSuccessData(data);
      
      // Call onSuccess callback if provided
      if (onSuccess) {
        onSuccess(data);
      }
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while starting your trial');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Calculate trial end date
  const trialEndDate = new Date();
  trialEndDate.setDate(trialEndDate.getDate() + plan.trialDays);
  const formattedEndDate = trialEndDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  
  if (successData) {
    return (
      <div className={`bg-white rounded-lg shadow-md p-6 ${className}`}>
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
            <svg
              className="h-6 w-6 text-green-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h3 className="mt-3 text-lg font-medium text-gray-900">Trial started successfully!</h3>
          <p className="mt-2 text-sm text-gray-500">
            Your {plan.trialDays}-day free trial of {plan.name} has been activated.
            Your trial will end on {formattedEndDate}, at which point your account will be 
            automatically converted to a paid subscription.
          </p>
          <div className="mt-4">
            <button
              type="button"
              onClick={() => router.push('/dashboard')}
              className="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className={`bg-white rounded-lg shadow-md p-6 ${className}`}>
      <h2 className="text-xl font-semibold text-gray-900 mb-4">
        Start your {plan.trialDays}-day free trial
      </h2>
      <p className="text-gray-600 mb-6">
        Try {plan.name} risk-free for {plan.trialDays} days. No credit card required.
        Your trial will automatically convert to a paid subscription on {formattedEndDate}.
      </p>
      
      <div className="mb-6">
        <h3 className="text-sm font-medium text-gray-900 mb-2">What's included:</h3>
        <ul className="space-y-2">
          {plan.features.map((feature, index) => (
            <li key={index} className="flex items-start">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-green-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <span className="ml-2 text-sm text-gray-500">{feature}</span>
            </li>
          ))}
        </ul>
      </div>
      
      <form onSubmit={handleSubmit}>
        {!session && !organizationId && (
          <>
            <div className="mb-4">
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <input
                type="email"
                name="email"
                id="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
            
            <div className="mb-4">
              <label htmlFor="organizationName" className="block text-sm font-medium text-gray-700">
                Organization name
              </label>
              <input
                type="text"
                name="organizationName"
                id="organizationName"
                value={formData.organizationName}
                onChange={handleChange}
                required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
          </>
        )}
        
        <div className="mb-6">
          <div className="flex items-start">
            <div className="flex items-center h-5">
              <input
                id="agreeToTerms"
                name="agreeToTerms"
                type="checkbox"
                checked={formData.agreeToTerms}
                onChange={handleChange}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
            </div>
            <div className="ml-3 text-sm">
              <label htmlFor="agreeToTerms" className="font-medium text-gray-700">
                I agree to the terms and conditions
              </label>
              <p className="text-gray-500">
                By starting a trial, you agree to our{' '}
                <a href="/terms" className="text-indigo-600 hover:text-indigo-500">
                  Terms of Service
                </a>{' '}
                and{' '}
                <a href="/privacy" className="text-indigo-600 hover:text-indigo-500">
                  Privacy Policy
                </a>
                .
              </p>
            </div>
          </div>
        </div>
        
        {error && (
          <div className="mb-4 text-sm text-red-600">{error}</div>
        )}
        
        <button
          type="submit"
          disabled={isLoading}
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
        >
          {isLoading ? 'Starting your trial...' : `Start your ${plan.trialDays}-day free trial`}
        </button>
      </form>
    </div>
  );
} 