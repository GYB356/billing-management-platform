import { useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, X, Minus } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface Plan {
  id: string;
  name: string;
  price: number;
  currency: string;
  interval: string;
  features: Array<{
    name: string;
    included: boolean;
    value?: string;
  }>;
  usageLimits: Array<{
    featureKey: string;
    limit: number;
    interval: string;
    overage: boolean;
    overagePrice?: number;
  }>;
}

interface PlanDifference {
  featureName: string;
  values: Record<string, string | boolean | number | null>;
}

interface PlanComparisonProps {
  planIds: string[];
  onPlanSelect?: (planId: string) => void;
  currentPlanId?: string;
}

export function PlanComparison({
  planIds,
  onPlanSelect,
  currentPlanId,
}: PlanComparisonProps) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [differences, setDifferences] = useState<PlanDifference[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPlanComparison();
  }, [planIds.join(',')]);

  const fetchPlanComparison = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.append('action', 'compare');
      planIds.forEach(id => params.append('planId', id));

      const response = await fetch(`/api/subscriptions?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch plan comparison');
      }

      const data = await response.json();
      setPlans(data.plans);
      setDifferences(data.differences);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const renderFeatureValue = (value: string | boolean | number | null) => {
    if (typeof value === 'boolean') {
      return value ? (
        <Check className="h-5 w-5 text-green-500" />
      ) : (
        <X className="h-5 w-5 text-red-500" />
      );
    }

    if (value === null) {
      return <Minus className="h-5 w-5 text-gray-400" />;
    }

    return <span>{value}</span>;
  };

  if (loading) {
    return <div>Loading plan comparison...</div>;
  }

  if (error) {
    return <div className="text-red-500">Error: {error}</div>;
  }

  return (
    <div className="space-y-6">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-1/4">Feature</TableHead>
            {plans.map(plan => (
              <TableHead key={plan.id} className="text-center">
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold">{plan.name}</h3>
                  <div className="text-2xl font-bold">
                    {formatCurrency(plan.price, plan.currency)}
                    <span className="text-sm text-gray-500">
                      /{plan.interval}
                    </span>
                  </div>
                  {currentPlanId === plan.id && (
                    <Badge variant="outline">Current Plan</Badge>
                  )}
                  {onPlanSelect && currentPlanId !== plan.id && (
                    <Button
                      onClick={() => onPlanSelect(plan.id)}
                      variant="outline"
                      className="w-full"
                    >
                      Select Plan
                    </Button>
                  )}
                </div>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {differences.map(diff => (
            <TableRow key={diff.featureName}>
              <TableCell className="font-medium">{diff.featureName}</TableCell>
              {plans.map(plan => (
                <TableCell key={plan.id} className="text-center">
                  {renderFeatureValue(diff.values[plan.id])}
                </TableCell>
              ))}
            </TableRow>
          ))}
          <TableRow>
            <TableCell className="font-medium">Usage Limits</TableCell>
            {plans.map(plan => (
              <TableCell key={plan.id} className="text-center">
                <div className="space-y-2">
                  {plan.usageLimits.map(limit => (
                    <div key={limit.featureKey} className="text-sm">
                      <div className="font-medium">{limit.featureKey}</div>
                      <div>
                        {limit.limit.toLocaleString()} /{limit.interval}
                      </div>
                      {limit.overage && limit.overagePrice && (
                        <div className="text-gray-500">
                          {formatCurrency(limit.overagePrice, plan.currency)}/unit
                          overage
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </TableCell>
            ))}
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
} 