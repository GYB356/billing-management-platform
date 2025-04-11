import React from 'react';
import { useSubscription } from '@/hooks/useSubscription';
import { useInternationalization } from '@/hooks/useInternationalization';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Icons } from '@/components/ui/icons';
import { formatCurrency } from '@/lib/currency';

export function SubscriptionManager() {
  const { subscription, loading, error, changePlan, cancelSubscription, resumeSubscription } = useSubscription();
  const { locale, formatDate } = useInternationalization();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Icons.spinner className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-red-500">
        <p>Error loading subscription: {error.message}</p>
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="p-4">
        <p className="text-gray-500">No active subscription</p>
      </div>
    );
  }

  const isActive = subscription.status === 'ACTIVE';
  const isPaused = subscription.status === 'PAUSED';
  const isCanceled = subscription.status === 'CANCELED';

  return (
    <div className="space-y-4 p-4">
      {/* Current Plan */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">{subscription.plan.name}</h3>
          <Badge
            variant={
              isActive ? 'success' :
              isPaused ? 'warning' :
              isCanceled ? 'destructive' : 'secondary'
            }
          >
            {subscription.status}
          </Badge>
        </div>

        <div className="text-2xl font-bold">
          {formatCurrency(subscription.plan.price, subscription.plan.currency)}
          <span className="text-sm text-gray-500">/{subscription.plan.interval}</span>
        </div>

        <div className="text-sm text-gray-500">
          Current period: {formatDate(subscription.currentPeriodStart)} - {formatDate(subscription.currentPeriodEnd)}
        </div>

        {subscription.trialEndsAt && (
          <div className="text-sm text-blue-500">
            Trial ends: {formatDate(subscription.trialEndsAt)}
          </div>
        )}
      </Card>

      {/* Actions */}
      <div className="space-y-2">
        {isActive && (
          <>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" className="w-full">
                  Change Plan
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="h-[80vh]">
                <SheetHeader>
                  <SheetTitle>Change Your Plan</SheetTitle>
                </SheetHeader>
                <div className="mt-4">
                  {/* Plan selection content */}
                </div>
              </SheetContent>
            </Sheet>

            <Button
              variant="destructive"
              className="w-full"
              onClick={() => cancelSubscription()}
            >
              Cancel Subscription
            </Button>
          </>
        )}

        {isPaused && (
          <Button
            variant="default"
            className="w-full"
            onClick={() => resumeSubscription()}
          >
            Resume Subscription
          </Button>
        )}

        {isCanceled && subscription.cancelAtPeriodEnd && (
          <Button
            variant="default"
            className="w-full"
            onClick={() => resumeSubscription()}
          >
            Resume Subscription
          </Button>
        )}
      </div>

      {/* Usage Section */}
      <Card className="p-4">
        <h3 className="text-lg font-semibold mb-3">Usage</h3>
        <div className="space-y-2">
          {subscription.plan.usageLimits.map((limit) => (
            <div key={limit.id} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>{limit.featureKey}</span>
                <span>{limit.used} / {limit.limit}</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all"
                  style={{
                    width: `${Math.min((limit.used / limit.limit) * 100, 100)}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Payment History */}
      <Card className="p-4">
        <h3 className="text-lg font-semibold mb-3">Recent Payments</h3>
        <div className="space-y-2">
          {subscription.payments.slice(0, 3).map((payment) => (
            <div
              key={payment.id}
              className="flex justify-between items-center py-2 border-b last:border-0"
            >
              <div>
                <div className="font-medium">
                  {formatCurrency(payment.amount, payment.currency)}
                </div>
                <div className="text-sm text-gray-500">
                  {formatDate(payment.createdAt)}
                </div>
              </div>
              <Badge variant={payment.status === 'succeeded' ? 'success' : 'destructive'}>
                {payment.status}
              </Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
} 