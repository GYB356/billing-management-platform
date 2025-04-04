import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import prisma from '@/lib/prisma';
import SubscriptionManagementPanel from '@/components/subscription/SubscriptionManagementPanel';
import { SubscriptionPauseDialog } from '@/components/subscription/SubscriptionPauseDialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

async function getSubscriptionData(userId: string) {
  try {
    // Get the user's active subscription
    const subscription = await prisma.subscription.findFirst({
      where: {
        userId,
        // Include active, trialing, past_due, and paused subscriptions
        status: {
          in: ['active', 'trialing', 'past_due', 'paused', 'canceled']
        },
      },
      include: {
        plan: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!subscription) {
      return null;
    }

    // Format the subscription data for the component
    return {
      id: subscription.id,
      status: subscription.status,
      startDate: subscription.createdAt.toISOString(),
      endDate: subscription.endedAt ? subscription.endedAt.toISOString() : null,
      currentPeriodStart: subscription.currentPeriodStart.toISOString(),
      currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      trialEndsAt: subscription.trialEndsAt ? subscription.trialEndsAt.toISOString() : null,
      plan: {
        id: subscription.plan.id,
        name: subscription.plan.name,
        description: subscription.plan.description,
      },
      quantity: subscription.quantity,
      stripeSubscriptionId: subscription.stripeSubscriptionId,
      // We would fetch the latest invoice in a real implementation, 
      // but this is simplified for the example
      latestInvoice: subscription.latestInvoiceId ? {
        status: 'paid', // This would be fetched from Stripe
        amountDue: subscription.plan.price * subscription.quantity,
        currency: subscription.plan.currency || 'usd',
        invoiceUrl: `https://dashboard.stripe.com/invoices/${subscription.latestInvoiceId}`,
      } : undefined,
    };
  } catch (error) {
    console.error('Error fetching subscription data:', error);
    return null;
  }
}

async function getAvailablePlans() {
  try {
    // Get all published plans
    const plans = await prisma.plan.findMany({
      where: {
        isPublished: true,
      },
      orderBy: {
        price: 'asc',
      },
    });

    return plans.map(plan => ({
      id: plan.id,
      name: plan.name,
      description: plan.description || '',
      price: plan.price,
      currency: plan.currency || 'usd',
      interval: plan.interval || 'month',
      features: plan.features ? JSON.parse(plan.features) : [],
      isPopular: plan.isPopular || false,
    }));
  } catch (error) {
    console.error('Error fetching available plans:', error);
    return [];
  }
}

export default async function SubscriptionPage() {
  const session = await getServerSession(authOptions);
  
  // Redirect to login if not authenticated
  if (!session?.user) {
    redirect('/auth/signin');
  }

  const subscription = await getSubscriptionData(session.user.id);
  const availablePlans = await getAvailablePlans();

  if (!subscription) {
    return (
      <div className="container mx-auto py-8">
        <h1 className="text-2xl font-bold mb-4">No Active Subscription</h1>
        <p>You currently don't have an active subscription.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Subscription Management</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>Current Subscription</CardTitle>
          <CardDescription>
            Manage your subscription settings and billing information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">{subscription.plan.name}</h3>
              <p className="text-sm text-muted-foreground">
                {subscription.plan.description}
              </p>
            </div>
            <Badge variant={subscription.isPaused ? 'secondary' : 'default'}>
              {subscription.isPaused ? 'Paused' : 'Active'}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium">Status</p>
              <p className="text-sm text-muted-foreground capitalize">
                {subscription.status}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium">Billing Period</p>
              <p className="text-sm text-muted-foreground">
                {format(new Date(subscription.currentPeriodStart), 'MMM d, yyyy')} -{' '}
                {format(new Date(subscription.currentPeriodEnd), 'MMM d, yyyy')}
              </p>
            </div>
            {subscription.isPaused && (
              <>
                <div>
                  <p className="text-sm font-medium">Paused Since</p>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(subscription.pausedAt!), 'MMM d, yyyy')}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium">Resumes On</p>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(subscription.resumesAt!), 'MMM d, yyyy')}
                  </p>
                </div>
                {subscription.pauseReason && (
                  <div className="col-span-2">
                    <p className="text-sm font-medium">Pause Reason</p>
                    <p className="text-sm text-muted-foreground">
                      {subscription.pauseReason}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="flex justify-end space-x-4">
            <SubscriptionPauseDialog
              subscriptionId={subscription.id}
              isPaused={subscription.isPaused}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 