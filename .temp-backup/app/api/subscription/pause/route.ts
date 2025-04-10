import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';
import { sendSubscriptionPauseEmail } from '@/lib/email';
import { pauseSubscription } from '@/lib/services/subscription-service';
import { z } from 'zod';

// Validation schema for request
const pauseSubscriptionSchema = z.object({
  subscriptionId: z.string(),
  pauseDuration: z.number().min(1).max(90),
  reason: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate request body
    const body = await request.json();
    const validationResult = pauseSubscriptionSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Invalid request data', 
          details: validationResult.error.format() 
        }, 
        { status: 400 }
      );
    }
    
    const { subscriptionId, pauseDuration, reason } = validationResult.data;

    // Check if the user has permission to manage this subscription
    const subscription = await prisma.subscription.findFirst({
      where: {
        id: subscriptionId,
        organization: {
          userOrganizations: {
            some: {
              userId: session.user.id,
            },
          },
        },
      },
    });

    if (!subscription) {
      return NextResponse.json(
        { error: 'Subscription not found or you do not have permission to manage it' },
        { status: 404 }
      );
    }

    // Use the subscription service to pause the subscription
    const updatedSubscription = await pauseSubscription(
      subscriptionId,
      pauseDuration,
      reason
    );

    return NextResponse.json(updatedSubscription);
  } catch (error: any) {
    console.error('Error pausing subscription:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to pause subscription' },
      { status: 500 }
    );
  }
} 