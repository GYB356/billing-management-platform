import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const subscriptionId = searchParams.get('subscriptionId');

    if (!subscriptionId) {
      return NextResponse.json(
        { error: 'Subscription ID is required' },
        { status: 400 }
      );
    }

    // Verify the subscription belongs to the user
    const subscription = await prisma.subscription.findFirst({
      where: {
        id: subscriptionId,
        customer: {
          userId: session.user.id,
        },
      },
    });

    if (!subscription) {
      return NextResponse.json(
        { error: 'Subscription not found' },
        { status: 404 }
      );
    }

    // Get all alerts for the subscription
    const alerts = await prisma.usageAlert.findMany({
      where: {
        subscriptionId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json(alerts);
  } catch (error) {
    console.error('Error fetching usage alerts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch usage alerts' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { subscriptionId, featureId, threshold, type, notifyVia } = body;

    if (!subscriptionId || !featureId || !threshold || !type || !notifyVia) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Verify the subscription belongs to the user
    const subscription = await prisma.subscription.findFirst({
      where: {
        id: subscriptionId,
        customer: {
          userId: session.user.id,
        },
      },
    });

    if (!subscription) {
      return NextResponse.json(
        { error: 'Subscription not found' },
        { status: 404 }
      );
    }

    // Create the alert
    const alert = await prisma.usageAlert.create({
      data: {
        subscriptionId,
        featureId,
        threshold,
        type,
        notifyVia,
        enabled: true,
      },
    });

    return NextResponse.json(alert);
  } catch (error) {
    console.error('Error creating usage alert:', error);
    return NextResponse.json(
      { error: 'Failed to create usage alert' },
      { status: 500 }
    );
  }
}
