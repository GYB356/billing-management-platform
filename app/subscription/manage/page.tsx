'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Icons } from '@/components/ui/icons';
import { formatCurrency } from '@/lib/utils';
import { useSubscription } from '@/contexts/subscription-context';
import { useSubscriptionActions } from '@/hooks/use-subscription';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Download, Pause, Play } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function SubscriptionManagement() {
  const router = useRouter();
  const { subscription, loading: subscriptionLoading, error: subscriptionError } = useSubscription();
  const { cancelSubscription, resumeSubscription } = useSubscriptionActions();
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [pauseDuration, setPauseDuration] = useState<string>('30');
  const [pauseDialogOpen, setPauseDialogOpen] = useState(false);

  const handleCancel = async () => {
    if (!subscription) return;

    try {
      setUpdating(true);
      setError(null);
      await cancelSubscription();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel subscription');
    } finally {
      setUpdating(false);
    }
  };

  const handleResume = async () => {
    if (!subscription) return;

    try {
      setUpdating(true);
      setError(null);
      await resumeSubscription();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resume subscription');
    } finally {
      setUpdating(false);
    }
  };

  const handlePause = async () => {
    if (!subscription) return;

    try {
      setUpdating(true);
      setError(null);
      const response = await fetch('/api/subscription/pause', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pauseDuration: parseInt(pauseDuration) }),
      });

      if (!response.ok) {
        throw new Error('Failed to pause subscription');
      }

      setPauseDialogOpen(false);
      await router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to pause subscription');
    } finally {
      setUpdating(false);
    }
  };

  const handleDownloadInvoice = async () => {
    if (!subscription) return;

    try {
      setDownloading(true);
      const response = await fetch(`/api/subscription/${subscription.id}/invoice`);
      
      if (!response.ok) {
        throw new Error('Failed to generate invoice');
      }

      // Create a blob from the PDF stream
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download invoice');
    } finally {
      setDownloading(false);
    }
  };

  if (subscriptionLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Icons.spinner className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (subscriptionError) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-500">{subscriptionError}</div>
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen space-y-4">
        <h2 className="text-2xl font-bold">No Active Subscription</h2>
        <Button onClick={() => router.push('/subscription/checkout')}>
          Subscribe Now
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-8">Subscription Management</h1>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Current Plan</CardTitle>
          <CardDescription>
            Your subscription details and billing information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold">Plan Name</h3>
              <p>{subscription.plan.name}</p>
            </div>
            <div>
              <h3 className="font-semibold">Price</h3>
              <p>{formatCurrency(subscription.plan.price)} / {subscription.plan.interval}</p>
            </div>
            <div>
              <h3 className="font-semibold">Status</h3>
              <p className={
                subscription.status === 'paused'
                  ? 'text-yellow-500'
                  : subscription.cancelAtPeriodEnd
                  ? 'text-orange-500'
                  : 'text-green-500'
              }>
                {subscription.status === 'paused'
                  ? `Paused (Resumes ${format(new Date(subscription.resumesAt), 'PPP')})`
                  : subscription.cancelAtPeriodEnd
                  ? 'Cancelling at period end'
                  : 'Active'}
              </p>
            </div>
            <div>
              <h3 className="font-semibold">Current Period</h3>
              <p>
                {format(new Date(subscription.currentPeriodEnd), 'PPP')}
              </p>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          {error && (
            <Alert variant="destructive" className="w-full">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          <div className="flex justify-between w-full">
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleDownloadInvoice}
                disabled={downloading}
              >
                {downloading ? (
                  <>
                    <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
                    Downloading...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Download Invoice
                  </>
                )}
              </Button>

              {subscription.status === 'active' && !subscription.cancelAtPeriodEnd && (
                <Dialog open={pauseDialogOpen} onOpenChange={setPauseDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline">
                      <Pause className="mr-2 h-4 w-4" />
                      Pause Subscription
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Pause Subscription</DialogTitle>
                      <DialogDescription>
                        Choose how long you want to pause your subscription. Your subscription will automatically resume after this period.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                      <Select
                        value={pauseDuration}
                        onValueChange={setPauseDuration}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select pause duration" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="30">30 days</SelectItem>
                          <SelectItem value="60">60 days</SelectItem>
                          <SelectItem value="90">90 days</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => setPauseDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handlePause}
                        disabled={updating}
                      >
                        {updating ? (
                          <>
                            <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
                            Pausing...
                          </>
                        ) : (
                          'Confirm Pause'
                        )}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </div>

            <div>
              {subscription.status === 'paused' ? (
                <Button onClick={handleResume} disabled={updating}>
                  {updating ? (
                    <>
                      <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
                      Resuming...
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-4 w-4" />
                      Resume Now
                    </>
                  )}
                </Button>
              ) : subscription.cancelAtPeriodEnd ? (
                <Button onClick={handleResume} disabled={updating}>
                  {updating ? (
                    <>
                      <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
                      Resuming...
                    </>
                  ) : (
                    'Resume Subscription'
                  )}
                </Button>
              ) : (
                <Button variant="destructive" onClick={handleCancel} disabled={updating}>
                  {updating ? (
                    <>
                      <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
                      Cancelling...
                    </>
                  ) : (
                    'Cancel Subscription'
                  )}
                </Button>
              )}
            </div>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
} 