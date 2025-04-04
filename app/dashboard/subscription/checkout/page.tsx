import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import prisma from '@/lib/prisma';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import CheckoutForm from '@/components/subscription/CheckoutForm';

// Make sure to call loadStripe outside of a component's render to avoid
// recreating the Stripe object on every render.
// This is your test publishable API key.
const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
);

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
      isFree: plan.price === 0,
    }));
  } catch (error) {
    console.error('Error fetching available plans:', error);
    return [];
  }
}

async function getUserHasActiveSubscription(userId: string) {
  try {
    // Check if user already has an active subscription
    const subscription = await prisma.subscription.findFirst({
      where: {
        userId,
        status: {
          in: ['active', 'trialing', 'past_due']
        },
      },
    });

    return !!subscription;
  } catch (error) {
    console.error('Error checking user subscription:', error);
    return false;
  }
}

export default async function CheckoutPage() {
  const session = await getServerSession(authOptions);
  
  // Redirect to login if not authenticated
  if (!session?.user) {
    redirect('/auth/signin');
  }

  // Check if user already has an active subscription
  const hasActiveSubscription = await getUserHasActiveSubscription(session.user.id);
  
  // If they have an active subscription, redirect to subscription management
  if (hasActiveSubscription) {
    redirect('/dashboard/subscription');
  }

  const availablePlans = await getAvailablePlans();

  // If no plans are available, show a message
  if (!availablePlans.length) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Choose a Plan</h1>
        <div className="bg-white shadow rounded-lg p-6">
          <p className="text-gray-600">No subscription plans are currently available. Please check back later.</p>
        </div>
      </div>
    );
  }

  // Create appearance options for Stripe Elements
  const appearance = {
    theme: 'stripe',
    variables: {
      colorPrimary: '#6366f1', // indigo-500
      colorBackground: '#ffffff',
      colorText: '#1f2937', // gray-800
      colorDanger: '#ef4444', // red-500
      fontFamily: 'system-ui, -apple-system, sans-serif',
      borderRadius: '0.375rem',
    },
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Choose a Plan</h1>
      
      <Elements stripe={stripePromise} options={{ appearance }}>
        <CheckoutForm availablePlans={availablePlans} />
      </Elements>
    </div>
  );
} 