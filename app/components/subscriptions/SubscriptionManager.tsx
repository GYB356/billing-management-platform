import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { PlanComparison } from './PlanComparison';
import { formatCurrency } from '@/lib/utils';

interface Subscription {
  id: string;
  status: string;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  pausedAt?: Date;
  resumesAt?: Date;
  plan: {
    id: string;
    name: string;
    price: number;
    currency: string;
    interval: string;
  };
}

interface SubscriptionManagerProps {
  subscription: Subscription;
  availablePlanIds: string[];
  onSubscriptionUpdate: () => void;
}

export function SubscriptionManager({
  subscription,
  availablePlanIds,
  onSubscriptionUpdate,
}: SubscriptionManagerProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showChangePlanDialog, setShowChangePlanDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showPauseDialog, setShowPauseDialog] = useState(false);

  const handleAction = async (action: 'activate' | 'cancel' | 'pause' | 'resume') => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/subscriptions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'updateStatus',
          subscriptionId: subscription.id,
          action,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update subscription status');
      }

      onSubscriptionUpdate();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setLoading(false);
      setShowCancelDialog(false);
      setShowPauseDialog(false);
    }
  };

  const handlePlanChange = async (newPlanId: string) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/subscriptions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'changePlan',
          subscriptionId: subscription.id,
          newPlanId,
          prorate: true,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to change subscription plan');
      }

      onSubscriptionUpdate();
      setShowChangePlanDialog(false);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Current Subscription</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm font-medium text-gray-500">Plan</div>
                <div className="text-lg font-semibold">{subscription.plan.name}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-500">Price</div>
                <div className="text-lg font-semibold">
                  {formatCurrency(subscription.plan.price, subscription.plan.currency)}
                  <span className="text-sm text-gray-500">
                    /{subscription.plan.interval}
                  </span>
                </div>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-500">Status</div>
                <div className="text-lg font-semibold">{subscription.status}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-500">Current Period End</div>
                <div className="text-lg font-semibold">
                  {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                </div>
              </div>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="flex gap-4">
              <Dialog open={showChangePlanDialog} onOpenChange={setShowChangePlanDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline">Change Plan</Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl">
                  <DialogHeader>
                    <DialogTitle>Change Subscription Plan</DialogTitle>
                    <DialogDescription>
                      Compare plans and select a new one. Changes will be prorated.
                    </DialogDescription>
                  </DialogHeader>
                  <PlanComparison
                    planIds={availablePlanIds}
                    onPlanSelect={handlePlanChange}
                    currentPlanId={subscription.plan.id}
                  />
                </DialogContent>
              </Dialog>

              {subscription.status === 'ACTIVE' && (
                <>
                  <Dialog open={showPauseDialog} onOpenChange={setShowPauseDialog}>
                    <DialogTrigger asChild>
                      <Button variant="outline">Pause Subscription</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Pause Subscription</DialogTitle>
                        <DialogDescription>
                          Your subscription will be paused for 30 days. You won't be charged
                          during this period.
                        </DialogDescription>
                      </DialogHeader>
                      <DialogFooter>
                        <Button
                          variant="outline"
                          onClick={() => setShowPauseDialog(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={() => handleAction('pause')}
                          disabled={loading}
                        >
                          Pause Subscription
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
                    <DialogTrigger asChild>
                      <Button variant="destructive">Cancel Subscription</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Cancel Subscription</DialogTitle>
                        <DialogDescription>
                          Your subscription will be canceled at the end of the current
                          billing period. You'll still have access until then.
                        </DialogDescription>
                      </DialogHeader>
                      <DialogFooter>
                        <Button
                          variant="outline"
                          onClick={() => setShowCancelDialog(false)}
                        >
                          Keep Subscription
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={() => handleAction('cancel')}
                          disabled={loading}
                        >
                          Cancel Subscription
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </>
              )}

              {subscription.status === 'PAUSED' && (
                <Button
                  onClick={() => handleAction('resume')}
                  disabled={loading}
                >
                  Resume Subscription
                </Button>
              )}

              {subscription.status === 'CANCELED' && !subscription.cancelAtPeriodEnd && (
                <Button
                  onClick={() => handleAction('activate')}
                  disabled={loading}
                >
                  Reactivate Subscription
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 