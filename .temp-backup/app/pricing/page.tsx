import PricingTable from '@/components/pricing/PricingTable';
import prisma from '@/lib/prisma';
import { useEffect, useState } from 'react';

export const metadata = {
  title: 'Pricing Plans',
  description: 'Choose the right plan for your needs',
};

export const revalidate = 3600; // Revalidate at most once per hour

async function getActivePlans() {
  const plans = await prisma.pricingPlan.findMany({
    where: {
      isActive: true,
      isPublic: true,
    },
    include: {
      tiers: true,
      planFeatures: {
        include: {
          feature: true,
        },
      },
    },
    orderBy: {
      sortOrder: 'asc',
    },
  });

  return plans;
}

async function getFeatures() {
  const features = await prisma.planFeature.findMany({
    orderBy: [
      {
        isHighlighted: 'desc',
      },
      {
        name: 'asc',
      },
    ],
  });

  return features;
}

export default function PricingPage() {
  const [plans, setPlans] = useState([]);

  useEffect(() => {
    async function fetchPlans() {
      try {
        const response = await fetch('/api/pricing/plans');
        if (!response.ok) {
          throw new Error('Failed to fetch pricing plans');
        }
        const data = await response.json();
        setPlans(data.plans || []); // Ensure plans is always an array
      } catch (error) {
        console.error('Failed to fetch pricing plans:', error);
        setPlans([]); // Fallback to an empty array on error
      }
    }

    console.log('Fetching plans...');
    fetchPlans();
  }, []);

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-center mb-8">Pricing Plans</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <div key={plan.id} className="border rounded-lg p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-gray-900">{plan.name}</h2>
            <p className="text-gray-500 mt-2">{plan.description}</p>
            <p className="text-2xl font-bold text-gray-900 mt-4">
              ${plan.price / 100} <span className="text-sm text-gray-500">/{plan.interval}</span>
            </p>
            <button
              className="mt-6 w-full py-2 px-4 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
              onClick={() => console.log(`Subscribe to ${plan.name}`)}
            >
              Subscribe to {plan.name}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}