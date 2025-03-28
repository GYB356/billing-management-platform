import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import prisma from '@/lib/prisma';
import SubscriptionManagementPanel from '@/components/subscription/SubscriptionManagementPanel';

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

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Subscription Management</h1>
      
      {subscription ? (
        <SubscriptionManagementPanel 
          subscription={subscription} 
          availablePlans={availablePlans}
        />
      ) : (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg font-medium text-gray-900">No active subscription</h3>
            <div className="mt-3 text-sm text-gray-500">
              <p>You don't have an active subscription yet.</p>
            </div>
            <div className="mt-5">
              <a
                href="/dashboard/subscription/checkout"
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Choose a plan
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 