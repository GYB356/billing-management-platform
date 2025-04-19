'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { Calendar, CheckCircle, AlertCircle, CreditCard, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useSubscription } from '@/hooks/use-subscription';

type SubscriptionStatus = 'ACTIVE' | 'CANCELED' | 'INCOMPLETE' | 'INCOMPLETE_EXPIRED' | 'TRIALING' | 'PAST_DUE' | 'UNPAID' | 'PAUSED';

interface SubscriptionProps {
  subscription: {
    id: string;
    providerId: string;
    status: SubscriptionStatus;
    planName: string;
    currentPeriodEnd: Date;
    cancelAt?: Date | null;
    canceledAt?: Date | null;
    trialEndsAt?: Date | null;
    createdAt: Date;
  } | null;
}

export function SubscriptionStatus({ subscription }: SubscriptionProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const router = useRouter();
  const { isLoading, cancelSubscription, resumeSubscription, openBillingPortal } = useSubscription();

  // Handle manage subscription
  const handleManageSubscription = async () => {
    await openBillingPortal();
  };

  // Handle subscription cancellation
  const handleCancelSubscription = () => {
    if (!subscription) return;
    
    cancelSubscription(subscription.providerId);
    setIsDialogOpen(false);
  };

  // Handle subscription resume
  const handleResumeSubscription = () => {
    if (!subscription) return;
    
    resumeSubscription(subscription.providerId);
  };

  // Format date for display
  const formatDate = (date: Date | null | undefined) => {
    if (!date) return 'N/A';
    return format(new Date(date), 'MMM d, yyyy');
  };

  // Get status badge component
  const StatusBadge = ({ status }: { status: SubscriptionStatus }) => {
    const variants: Record<SubscriptionStatus, { variant: 'default' | 'secondary' | 'destructive' | 'outline', label: string }> = {
      ACTIVE: { variant: 'default', label: 'Active' },
      TRIALING: { variant: 'secondary', label: 'Trial' },
      CANCELED: { variant: 'destructive', label: 'Canceled' },
      INCOMPLETE: { variant: 'outline', label: 'Incomplete' },
      INCOMPLETE_EXPIRED: { variant: 'destructive', label: 'Expired' },
      PAST_DUE: { variant: 'destructive', label: 'Past Due' },
      UNPAID: { variant: 'destructive', label: 'Unpaid' },
      PAUSED: { variant: 'outline', label: 'Paused' },
    };
    
    const config = variants[status] || { variant: 'outline', label: status };
    
    return (
      <Badge variant={config.variant}>{config.label}</Badge>
    );
  };

  // No subscription state
  if (!subscription) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>No active subscription</CardTitle>
          <CardDescription>You don&apos;t have any active subscription.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <AlertCircle size={16} />
            <span>Subscribe to a plan to access premium features.</span>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={() => router.push('/pricing')} className="w-full">
            View Plans
          </Button>
        </CardFooter>
      </Card>
    );
  }

  // Determine if subscription will auto-renew
  const willAutoRenew = 
    subscription.status === 'ACTIVE' && 
    !subscription.cancelAt && 
    !subscription.canceledAt;

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Subscription</CardTitle>
          <StatusBadge status={subscription.status} />
        </div>
        <CardDescription>Details about your current subscription.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium">Plan</span>
          <span className="text-xl font-bold">{subscription.planName}</span>
        </div>
        
        <div className="flex flex-col gap-4 mt-2">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar size={16} />
            <span>Current period ends on {formatDate(subscription.currentPeriodEnd)}</span>
          </div>
          
          {subscription.trialEndsAt && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar size={16} />
              <span>Trial ends on {formatDate(subscription.trialEndsAt)}</span>
            </div>
          )}
          
          {willAutoRenew ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <CheckCircle size={16} className="text-green-500" />
              <span>Your subscription will automatically renew.</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-muted-foreground">
              <AlertCircle size={16} className="text-amber-500" />
              <span>
                {subscription.cancelAt 
                  ? `Your subscription will be canceled on ${formatDate(subscription.cancelAt)}.` 
                  : 'Your subscription will not renew.'}
              </span>
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter className="flex flex-col gap-2">
        {isLoading ? (
          <Button disabled className="w-full">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Please wait
          </Button>
        ) : (
          <>
            <Button onClick={handleManageSubscription} className="w-full">
              <CreditCard className="mr-2 h-4 w-4" />
              Manage Billing
            </Button>
            
            {subscription.status === 'ACTIVE' && (
              <>
                {willAutoRenew ? (
                  <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="w-full">
                        Cancel Subscription
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Cancel Subscription</DialogTitle>
                        <DialogDescription>
                          Are you sure you want to cancel your subscription? You will continue to have access until {formatDate(subscription.currentPeriodEnd)}.
                        </DialogDescription>
                      </DialogHeader>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                          Keep Subscription
                        </Button>
                        <Button variant="destructive" onClick={handleCancelSubscription}>
                          Cancel Subscription
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                ) : (
                  <Button variant="outline" className="w-full" onClick={handleResumeSubscription}>
                    Resume Subscription
                  </Button>
                )}
              </>
            )}
          </>
        )}
      </CardFooter>
    </Card>
  );
} 