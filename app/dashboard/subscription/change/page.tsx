import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import prisma from '@/lib/prisma';
import PlanChangeForm from '@/components/subscription/PlanChangeForm';

async function getSubscriptionData(userId: string) {
  try {
    // Get the user's active subscription
    const subscription = await prisma.subscription.findFirst({
      where: {
        userId,
        status: {
          in: ['active', 'trialing'] // Only active or trialing subscriptions can be changed
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
      currentPlan: {
        id: subscription.plan.id,
        name: subscription.plan.name,
        price: subscription.plan.price,
        currency: subscription.plan.currency || 'usd',
      },
      quantity: subscription.quantity,
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

export default async function ChangePlanPage() {
  const session = await getServerSession(authOptions);
  
  // Redirect to login if not authenticated
  if (!session?.user) {
    redirect('/auth/signin');
  }

  const subscription = await getSubscriptionData(session.user.id);
  
  // If no active subscription, redirect to subscription page
  if (!subscription) {
    redirect('/dashboard/subscription');
  }

  const availablePlans = await getAvailablePlans();

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Change Subscription Plan</h1>
      
      <PlanChangeForm 
        subscription={subscription} 
        availablePlans={availablePlans}
      />
    </div>
  );
} 