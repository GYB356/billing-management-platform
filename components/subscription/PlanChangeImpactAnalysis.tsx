import { useState, useEffect } from 'react';
import { AlertTriangle, ArrowUp, ArrowDown, Info } from 'lucide-react';
import { formatPrice } from '@/lib/utils/currency';

interface PlanChangeImpactProps {
  subscriptionId: string;
  newPlanId: string;
  quantity?: number;
}

interface FeatureChange {
  feature: string;
  oldLimit: number;
  newLimit: number;
}

interface ImpactAnalysis {
  type: 'upgrade' | 'downgrade' | 'crossgrade';
  proratedAmount: number;
  effectiveDate: string;
  featureChanges: {
    added: string[];
    removed: string[];
    upgraded: FeatureChange[];
    downgraded: FeatureChange[];
  };
}

export default function PlanChangeImpactAnalysis({
  subscriptionId,
  newPlanId,
  quantity
}: PlanChangeImpactProps) {
  const [impact, setImpact] = useState<ImpactAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchImpact = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch(`/api/subscriptions/${subscriptionId}/plan-change-impact`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            newPlanId,
            quantity
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to analyze plan change impact');
        }

        setImpact(data);
      } catch (err: any) {
        setError(err.message || 'An error occurred while analyzing the plan change');
      } finally {
        setLoading(false);
      }
    };

    fetchImpact();
  }, [subscriptionId, newPlanId, quantity]);

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-600 flex items-center">
        <AlertTriangle className="h-5 w-5 mr-2" />
        {error}
      </div>
    );
  }

  if (!impact) return null;

  return (
    <div className="space-y-4">
      {/* Plan Change Type Indicator */}
      <div className={`p-4 rounded-lg ${
        impact.type === 'upgrade' ? 'bg-green-50 border border-green-200' :
        impact.type === 'downgrade' ? 'bg-yellow-50 border border-yellow-200' :
        'bg-blue-50 border border-blue-200'
      }`}>
        <div className="flex items-center">
          {impact.type === 'upgrade' ? (
            <ArrowUp className="h-5 w-5 text-green-500 mr-2" />
          ) : impact.type === 'downgrade' ? (
            <ArrowDown className="h-5 w-5 text-yellow-500 mr-2" />
          ) : (
            <Info className="h-5 w-5 text-blue-500 mr-2" />
          )}
          <div>
            <h4 className="text-sm font-medium">
              {impact.type === 'upgrade' ? 'Plan Upgrade' :
               impact.type === 'downgrade' ? 'Plan Downgrade' :
               'Plan Change'}
            </h4>
            <p className="text-sm text-gray-600">
              Changes will take effect on {new Date(impact.effectiveDate).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>

      {/* Proration Amount */}
      {impact.proratedAmount !== 0 && (
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <h4 className="text-sm font-medium">Price Adjustment</h4>
          <p className="text-sm text-gray-600">
            {impact.proratedAmount > 0 
              ? `You'll be charged an additional ${formatPrice(impact.proratedAmount)}` 
              : `You'll receive a credit of ${formatPrice(Math.abs(impact.proratedAmount))}`}
          </p>
        </div>
      )}

      {/* Feature Changes */}
      <div className="space-y-3">
        {impact.featureChanges.added.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-green-700">New Features</h4>
            <ul className="mt-1 text-sm text-gray-600">
              {impact.featureChanges.added.map(feature => (
                <li key={feature} className="flex items-center">
                  <span className="mr-2">•</span>
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        )}

        {impact.featureChanges.removed.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-red-700">Removed Features</h4>
            <ul className="mt-1 text-sm text-gray-600">
              {impact.featureChanges.removed.map(feature => (
                <li key={feature} className="flex items-center">
                  <span className="mr-2">•</span>
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        )}

        {impact.featureChanges.upgraded.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-green-700">Upgraded Features</h4>
            <ul className="mt-1 text-sm text-gray-600">
              {impact.featureChanges.upgraded.map(change => (
                <li key={change.feature} className="flex items-center">
                  <span className="mr-2">•</span>
                  {change.feature}: {change.oldLimit.toLocaleString()} → {change.newLimit.toLocaleString()}
                </li>
              ))}
            </ul>
          </div>
        )}

        {impact.featureChanges.downgraded.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-yellow-700">Changed Limits</h4>
            <ul className="mt-1 text-sm text-gray-600">
              {impact.featureChanges.downgraded.map(change => (
                <li key={change.feature} className="flex items-center">
                  <span className="mr-2">•</span>
                  {change.feature}: {change.oldLimit.toLocaleString()} → {change.newLimit.toLocaleString()}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}