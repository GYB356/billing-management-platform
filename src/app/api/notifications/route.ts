import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's subscription status
    const subscription = await prisma.subscription.findFirst({
      where: {
        user: {
          email: session.user.email,
        },
      },
    });

    // Check for subscription-related notifications
    if (subscription) {
      // Check for upcoming renewal
      const renewalDate = new Date(subscription.currentPeriodEnd);
      const now = new Date();
      const daysUntilRenewal = Math.ceil((renewalDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (daysUntilRenewal <= 7 && daysUntilRenewal > 0) {
        return NextResponse.json({
          notification: {
            type: 'warning',
            message: `Your subscription will renew in ${daysUntilRenewal} days.`,
            action: {
              label: 'View Subscription',
              href: '/dashboard',
            },
          },
        });
      }

      // Check for payment failure
      if (subscription.status === 'past_due') {
        return NextResponse.json({
          notification: {
            type: 'error',
            message: 'Your subscription payment failed. Please update your payment method.',
            action: {
              label: 'Update Payment Method',
              href: '/dashboard',
            },
          },
        });
      }

      // Check for successful payment
      if (subscription.status === 'active' && subscription.lastPaymentStatus === 'succeeded') {
        return NextResponse.json({
          notification: {
            type: 'success',
            message: 'Your subscription payment was successful.',
          },
        });
      }
    }

    // Return null if no notifications
    return NextResponse.json({ notification: null });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 }
    );
  }
} 