'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, Check } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface Plan {
  id: string;
  name: string;
  price: number;
  interval: 'month' | 'year';
  features: string[];
}

interface PlanUpgradeModalProps {
  currentPlan?: Plan;
  availablePlans: Plan[];
  onClose: () => void;
  onSuccess: () => void;
}

export default function PlanUpgradeModal({
  currentPlan,
  availablePlans,
  onClose,
  onSuccess,
}: PlanUpgradeModalProps) {
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const handlePlanChange = async () => {
    if (!selectedPlan) return;

    setProcessing(true);
    setError(null);

    try {
      const response = await fetch('/api/customer/subscription/change-plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planId: selectedPlan.id,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to change plan');
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change plan');
    } finally {
      setProcessing(false);
    }
  };

  const isPlanDowngrade = (plan: Plan) => {
    if (!currentPlan) return false;
    return plan.price < currentPlan.price;
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Change Subscription Plan</DialogTitle>
          <DialogDescription>
            Choose the plan that best fits your needs
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {availablePlans.map((plan) => {
            const isSelected = selectedPlan?.id === plan.id;
            const isCurrent = currentPlan?.id === plan.id;
            const isDowngrade = isPlanDowngrade(plan);

            return (
              <Card
                key={plan.id}
                className={`relative cursor-pointer transition-all ${
                  isSelected ? 'border-primary ring-2 ring-primary' : ''
                }`}
                onClick={() => setSelectedPlan(plan)}
              >
                {isCurrent && (
                  <div className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-xs px-2 py-1 rounded-full">
                    Current Plan
                  </div>
                )}
                <CardHeader>
                  <CardTitle>{plan.name}</CardTitle>
                  <CardDescription>
                    {formatCurrency(plan.price)} / {plan.interval}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-start">
                        <Check className="h-4 w-4 mr-2 mt-1 text-green-500" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="flex justify-end space-x-2 mt-4">
          <Button variant="outline" onClick={onClose} disabled={processing}>
            Cancel
          </Button>
          <Button
            onClick={handlePlanChange}
            disabled={!selectedPlan || processing || selectedPlan.id === currentPlan?.id}
          >
            {processing
              ? 'Processing...'
              : selectedPlan
              ? `Confirm ${isPlanDowngrade(selectedPlan) ? 'Downgrade' : 'Upgrade'}`
              : 'Select a Plan'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
