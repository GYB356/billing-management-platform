import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { SubscriptionService } from '@/lib/services/subscription-service';
import { z } from 'zod';

const impactAnalysisSchema = z.object({
  newPlanId: z.string(),
  quantity: z.number().optional()
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
    const validationResult = impactAnalysisSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Invalid request data',
          details: validationResult.error.format()
        },
        { status: 400 }
      );
    }

    const { newPlanId, quantity } = validationResult.data;

    // Initialize subscription service
    const subscriptionService = new SubscriptionService();

    // Get impact analysis
    const impact = await subscriptionService.calculatePlanChangeImpact(
      params.id,
      newPlanId,
      quantity
    );

    return NextResponse.json(impact);
  } catch (error: any) {
    console.error('Error calculating plan change impact:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to calculate plan change impact' },
      { status: 500 }
    );
  }
}