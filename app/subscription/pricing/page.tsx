'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';

interface Plan {
  id: string;
  name: string;
  description: string;
  price: number;
  interval: string;
  features: string[];
}

const plans: Plan[] = [
  {
    id: 'basic',
    name: 'Basic',
    description: 'Perfect for small businesses',
    price: 29,
    interval: 'month',
    features: [
      'Up to 5 users',
      'Basic analytics',
      'Email support',
      'API access',
    ],
  },
  {
    id: 'pro',
    name: 'Professional',
    description: 'Ideal for growing companies',
    price: 99,
    interval: 'month',
    features: [
      'Up to 20 users',
      'Advanced analytics',
      'Priority support',
      'API access',
      'Custom integrations',
      'Team management',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'For large organizations',
    price: 299,
    interval: 'month',
    features: [
      'Unlimited users',
      'Enterprise analytics',
      '24/7 support',
      'API access',
      'Custom integrations',
      'Team management',
      'SLA guarantee',
      'Dedicated account manager',
    ],
  },
];

export default function PricingPage() {
  const router = useRouter();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubscribe = async (planId: string) => {
    try {
      setIsLoading(true);
      // Store the selected plan in session storage
      sessionStorage.setItem('selectedPlan', planId);
      // Redirect to checkout
      router.push('/subscription/checkout');
    } catch (error) {
      console.error('Error selecting plan:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">Choose Your Plan</h1>
        <p className="text-lg text-gray-600">
          Select the perfect plan for your business needs
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
        {plans.map((plan) => (
          <Card
            key={plan.id}
            className={`relative ${
              selectedPlan === plan.id ? 'border-primary shadow-lg' : ''
            }`}
          >
            <CardHeader>
              <CardTitle className="text-2xl">{plan.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-6">
                <span className="text-4xl font-bold">${plan.price}</span>
                <span className="text-gray-600">/{plan.interval}</span>
              </div>
              <p className="text-gray-600 mb-6">{plan.description}</p>
              <ul className="space-y-4">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-center">
                    <Check className="h-5 w-5 text-green-500 mr-2" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Button
                className="w-full"
                onClick={() => handleSubscribe(plan.id)}
                disabled={isLoading}
              >
                {isLoading ? 'Processing...' : 'Select Plan'}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
} 