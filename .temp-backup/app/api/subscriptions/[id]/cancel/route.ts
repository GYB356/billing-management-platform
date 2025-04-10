import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { SubscriptionService } from '@/lib/services/subscription-service';
import { z } from 'zod';

const cancelSubscriptionSchema = z.object({
  cancelImmediately: z.boolean().optional().default(false),
  reason: z.string(),
  additionalFeedback: z.string().optional()
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Validate session
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await req.json();
    const validationResult = cancelSubscriptionSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Invalid request data',
          details: validationResult.error.format()
        },
        { status: 400 }
      );
    }

    const { cancelImmediately, reason, additionalFeedback } = validationResult.data;

    // Initialize subscription service
    const subscriptionService = new SubscriptionService();

    // Cancel subscription with feedback
    const result = await subscriptionService.cancelSubscriptionWithFeedback(
      params.id,
      {
        reason,
        additionalFeedback,
        cancelImmediately
      }
    );

    return NextResponse.json({
      message: cancelImmediately 
        ? 'Subscription canceled successfully' 
        : 'Subscription will be canceled at the end of the billing period',
      subscription: result
    });
  } catch (error: any) {
    console.error('Error canceling subscription:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to cancel subscription' },
      { status: 500 }
    );
  }
}