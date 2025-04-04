import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    // Get authenticated user
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Parse request body
    const body = await request.json();
    const { subscriptionId, featureId, quantity } = body;
    
    if (!subscriptionId || !featureId || typeof quantity !== 'number' || quantity < 0) {
      return NextResponse.json(
        { error: 'Required fields: subscriptionId, featureId, and a positive quantity' }, 
        { status: 400 }
      );
    }
    
    // Verify subscription belongs to the user's organization
    const subscription = await prisma.subscription.findFirst({
      where: {
        id: subscriptionId,
        organization: {
          userOrganizations: {
            some: {
              user: {
                email: session.user.email,
              },
            },
          },
        },
      },
    });
    
    if (!subscription) {
      return NextResponse.json(
        { error: 'Subscription not found or does not belong to your organization' }, 
        { status: 404 }
      );
    }
    
    // Verify feature is part of the subscription plan
    const featureExists = await prisma.planFeatureAssociation.findFirst({
      where: {
        planId: subscription.planId,
        featureId: featureId,
      },
    });
    
    if (!featureExists) {
      return NextResponse.json(
        { error: 'Feature not available in the current subscription plan' }, 
        { status: 400 }
      );
    }
    
    // Create usage record
    const usageRecord = await prisma.usageRecord.create({
      data: {
        subscriptionId,
        featureId,
        quantity,
      },
    });
    
    return NextResponse.json(usageRecord, { status: 201 });
  } catch (error) {
    console.error('Error recording usage:', error);
    return NextResponse.json(
      { error: 'Failed to record usage' }, 
      { status: 500 }
    );
  }
} 